import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq, like } from 'drizzle-orm';
import { isForeignKeyViolation, isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { clients, employees, projects, projectTypes, sites } from '../db/schema.js';
import { LookupsService } from '../lookups/lookups.service.js';
import { closeOpenAssignments } from '../assignments/assignments.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { ProjectDto, ProjectInput, ProjectStatus } from './projects.dto.js';

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly lookups: LookupsService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * One query with JOINs returns each project with its client, site and type
   * names, so the web app gets the flat shape it already uses.
   */
  private selectProjects() {
    return this.db
      .select({
        id: projects.id,
        code: projects.code,
        name: projects.name,
        clientName: clients.name,
        site: sites.name,
        projectType: projectTypes.name,
        workOrderNo: projects.workOrderNo,
        poNo: projects.poNo,
        managerId: projects.managerId,
        contractValue: projects.contractValue,
        estimatedCost: projects.estimatedCost,
        allottedManDays: projects.allottedManDays,
        allottedExpenses: projects.allottedExpenses,
        operationalCostPerManDay: projects.operationalCostPerManDay,
        startDate: projects.startDate,
        endDate: projects.endDate,
        periodStart: projects.periodStart,
        description: projects.description,
        status: projects.status,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .innerJoin(sites, eq(projects.siteId, sites.id))
      .innerJoin(projectTypes, eq(projects.projectTypeId, projectTypes.id));
  }

  async list(): Promise<ProjectDto[]> {
    const rows = await this.selectProjects().orderBy(desc(projects.startDate));
    return rows as ProjectDto[];
  }

  async get(id: string): Promise<ProjectDto> {
    const [row] = await this.selectProjects().where(eq(projects.id, id));
    if (!row) throw new NotFoundException('Project not found');
    return row as ProjectDto;
  }

  async create(input: ProjectInput): Promise<ProjectDto> {
    await this.checkManager(input.managerId);
    const id = await this.run(() =>
      // A transaction: the new client/site/type rows and the project are saved
      // together, or not at all if anything fails.
      this.db.transaction(async (tx) => {
        const refs = await this.resolveNames(input, tx);
        const code = input.code ?? (await this.nextCode(input.startDate, tx));
        const { code: _code, clientName: _c, site: _s, projectType: _t, ...fields } = input;
        const [row] = await tx
          .insert(projects)
          .values({ ...fields, ...refs, code, periodStart: input.startDate })
          .returning({ id: projects.id });
        return row.id;
      }),
    );
    const project = await this.get(id);
    await this.notifications.notify({
      type: 'project_created',
      title: 'New project created',
      message: `${project.name} for ${project.clientName} has been created.`,
      link: `/projects/${id}`,
      audienceRoles: ['management', 'accounts'],
      audienceEmployeeIds: [project.managerId],
    });
    return project;
  }

  async update(id: string, input: ProjectInput): Promise<ProjectDto> {
    await this.checkManager(input.managerId);
    const [before] = await this.db.select({ managerId: projects.managerId }).from(projects).where(eq(projects.id, id));
    await this.run(() =>
      this.db.transaction(async (tx) => {
        const refs = await this.resolveNames(input, tx);
        const { code, clientName: _c, site: _s, projectType: _t, ...fields } = input;
        const [row] = await tx
          .update(projects)
          .set({ ...fields, ...refs, ...(code ? { code } : {}) })
          .where(eq(projects.id, id))
          .returning({ id: projects.id });
        if (!row) throw new NotFoundException('Project not found');
        if (input.status === 'completed') await closeOpenAssignments(tx, id);
      }),
    );
    const project = await this.get(id);
    if (before && before.managerId !== input.managerId) {
      await this.notifications.notify({
        type: 'engineer_assigned',
        title: 'Project manager assigned',
        message: `You are now the project manager for ${project.name}.`,
        link: `/projects/${id}`,
        audienceRoles: [],
        audienceEmployeeIds: [input.managerId],
      });
    }
    return project;
  }

  async setStatus(id: string, status: ProjectStatus): Promise<ProjectDto> {
    await this.db.transaction(async (tx) => {
      const [row] = await tx.update(projects).set({ status }).where(eq(projects.id, id)).returning({ id: projects.id });
      if (!row) throw new NotFoundException('Project not found');
      // Completing a project releases everyone still assigned to it.
      if (status === 'completed') await closeOpenAssignments(tx, id);
    });
    return this.get(id);
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.run(() => this.db.delete(projects).where(eq(projects.id, id)).returning({ id: projects.id }));
    if (!row) throw new NotFoundException('Project not found');
  }

  private async resolveNames(input: ProjectInput, tx: Parameters<Parameters<Database['transaction']>[0]>[0]) {
    return {
      clientId: await this.lookups.findOrCreate(clients, input.clientName, tx),
      siteId: await this.lookups.findOrCreate(sites, input.site, tx),
      projectTypeId: await this.lookups.findOrCreate(projectTypes, input.projectType, tx),
    };
  }

  private async checkManager(managerId: string) {
    const [m] = await this.db.select({ id: employees.id }).from(employees).where(eq(employees.id, managerId));
    if (!m) throw new BadRequestException('Project manager not found');
  }

  /** PRJ-<start year>-NNN, one more than the highest number used that year. */
  private async nextCode(startDate: string, tx: Pick<Database, 'select'>): Promise<string> {
    const prefix = `PRJ-${startDate.slice(0, 4)}-`;
    const rows = await tx.select({ code: projects.code }).from(projects).where(like(projects.code, `${prefix}%`));
    const max = Math.max(0, ...rows.map((r) => Number(r.code.slice(prefix.length)) || 0));
    return `${prefix}${String(max + 1).padStart(3, '0')}`;
  }

  /** Runs a query and turns constraint errors into 409 answers. */
  private async run<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('This project ID is already in use');
      if (isForeignKeyViolation(err)) throw new ConflictException('This project still has records linked to it');
      throw err;
    }
  }
}
