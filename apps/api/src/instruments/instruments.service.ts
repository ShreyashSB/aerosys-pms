import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { todayIST } from '../common/dates.js';
import { isUniqueViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { employees, instrumentDeployments, instruments, type InstrumentDeployment } from '../db/schema.js';
import type { CurrentUser } from '../auth/current-user.js';
import { assertProjectAccess } from '../auth/project-access.js';
import { findProject, isClosed } from '../projects/find-project.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import type { DeploymentQuery, InstrumentDto, InstrumentInput, IssueInput, StatusInput } from './instruments.dto.js';

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

@Injectable()
export class InstrumentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * A LEFT JOIN to the open deployment: every instrument comes back, with the
   * engineer and project filled in only while it is out.
   */
  private select(db: Database | Tx = this.db) {
    return db
      .select({
        id: instruments.id,
        code: instruments.code,
        name: instruments.name,
        serialNumber: instruments.serialNumber,
        category: instruments.category,
        assetValue: instruments.assetValue,
        purchaseDate: instruments.purchaseDate,
        endOfLifeDate: instruments.endOfLifeDate,
        currentLocation: instruments.currentLocation,
        calibration: instruments.calibration,
        status: sql<string>`CASE WHEN ${instrumentDeployments.id} IS NULL THEN ${instruments.status} ELSE 'assigned' END`,
        assignedEngineerId: instrumentDeployments.engineerId,
        assignedProjectId: instrumentDeployments.projectId,
        notes: instruments.notes,
      })
      .from(instruments)
      .leftJoin(instrumentDeployments, and(eq(instrumentDeployments.instrumentId, instruments.id), isNull(instrumentDeployments.returnedAt)))
      .$dynamic();
  }

  list(): Promise<InstrumentDto[]> {
    return this.select().orderBy(asc(instruments.code));
  }

  async get(id: string, db: Database | Tx = this.db): Promise<InstrumentDto> {
    const [row] = await this.select(db).where(eq(instruments.id, id));
    if (!row) throw new NotFoundException('Instrument not found');
    return row;
  }

  listDeployments(q: DeploymentQuery): Promise<InstrumentDeployment[]> {
    return this.db
      .select()
      .from(instrumentDeployments)
      .where(
        and(
          q.projectId ? eq(instrumentDeployments.projectId, q.projectId) : undefined,
          q.instrumentId ? eq(instrumentDeployments.instrumentId, q.instrumentId) : undefined,
        ),
      )
      .orderBy(desc(instrumentDeployments.assignedAt));
  }

  async create(input: InstrumentInput): Promise<InstrumentDto> {
    const code = input.code ?? (await this.nextCode());
    const [row] = await this.write(() => this.db.insert(instruments).values({ ...input, code }).returning({ id: instruments.id }));
    return this.get(row.id);
  }

  async update(id: string, input: InstrumentInput): Promise<InstrumentDto> {
    const [row] = await this.write(() =>
      this.db
        .update(instruments)
        .set({ ...input, code: input.code ?? undefined })
        .where(eq(instruments.id, id))
        .returning({ id: instruments.id }),
    );
    if (!row) throw new NotFoundException('Instrument not found');
    return this.get(id);
  }

  /** Issue the instrument to an engineer on a project. Any earlier deployment is returned today. */
  async assign(id: string, { engineerId, projectId }: IssueInput, user: CurrentUser): Promise<InstrumentDto> {
    // A project manager can issue instruments only to their own projects.
    await assertProjectAccess(this.db, user, projectId);
    const issued = await this.db.transaction(async (tx) => {
      const current = await this.get(id, tx);
      if (current.status === 'retired') throw new BadRequestException('Retired instruments cannot be assigned');
      if (current.status === 'maintenance') throw new BadRequestException('Instrument is under maintenance');
      const project = await findProject(tx, projectId);
      if (isClosed(project)) throw new BadRequestException('Cannot issue instruments to a closed project');
      const [eng] = await tx.select({ id: employees.id, name: employees.name }).from(employees).where(eq(employees.id, engineerId));
      if (!eng) throw new BadRequestException('Engineer not found');
      await this.closeOpen(tx, id);
      try {
        await tx.insert(instrumentDeployments).values({ instrumentId: id, projectId, engineerId, assignedAt: todayIST() });
      } catch (err) {
        // Two people issuing the same instrument at once: the partial unique index lets only one through.
        if (isUniqueViolation(err)) throw new ConflictException('This instrument was just issued by someone else');
        throw err;
      }
      return { instrument: await this.get(id, tx), project, engineer: eng };
    });
    const { instrument, project, engineer } = issued;
    await this.notifications.notify({
      type: 'instrument_assigned',
      title: 'Instrument issued',
      message: `${instrument.name} (${instrument.code}) issued to ${engineer.name} for ${project.name}.`,
      link: '/instruments',
      audienceRoles: ['management'],
      audienceEmployeeIds: [engineer.id, project.managerId],
    });
    return instrument;
  }

  /** Back from site: close the open deployment. */
  async returnInstrument(id: string): Promise<InstrumentDto> {
    return this.db.transaction(async (tx) => {
      const current = await this.get(id, tx);
      if (current.status !== 'assigned') throw new BadRequestException('This instrument is not out on a project');
      await this.closeOpen(tx, id);
      await tx.update(instruments).set({ status: 'available' }).where(eq(instruments.id, id));
      return this.get(id, tx);
    });
  }

  /** Available, under maintenance or retired. Also brings it back if it was out. */
  async setStatus(id: string, { status, notes }: StatusInput): Promise<InstrumentDto> {
    return this.db.transaction(async (tx) => {
      await this.get(id, tx);
      await this.closeOpen(tx, id);
      await tx.update(instruments).set({ status, notes }).where(eq(instruments.id, id));
      return this.get(id, tx);
    });
  }

  private closeOpen(tx: Tx, instrumentId: string) {
    return tx
      .update(instrumentDeployments)
      .set({ returnedAt: todayIST() })
      .where(and(eq(instrumentDeployments.instrumentId, instrumentId), isNull(instrumentDeployments.returnedAt)));
  }

  /** INS-001, INS-002, … one more than the highest number in use. */
  private async nextCode(): Promise<string> {
    const rows = await this.db.select({ code: instruments.code }).from(instruments);
    const max = Math.max(0, ...rows.map((r) => Number(r.code.split('-').pop()) || 0));
    return `INS-${String(max + 1).padStart(3, '0')}`;
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (isUniqueViolation(err)) throw new ConflictException('An instrument with this ID or serial number already exists');
      throw err;
    }
  }
}
