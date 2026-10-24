import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { desc, eq } from 'drizzle-orm';
import { isForeignKeyViolation } from '../common/pg-errors.js';
import { DB, type Database } from '../db/db.module.js';
import { projectDocuments, type ProjectDocument } from '../db/schema.js';
import { findProject } from '../projects/find-project.js';
import type { DocumentInput } from './documents.dto.js';

@Injectable()
export class DocumentsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(projectId?: string): Promise<ProjectDocument[]> {
    return this.db
      .select()
      .from(projectDocuments)
      .where(projectId ? eq(projectDocuments.projectId, projectId) : undefined)
      .orderBy(desc(projectDocuments.uploadedAt));
  }

  async create(projectId: string, input: DocumentInput): Promise<ProjectDocument> {
    await findProject(this.db, projectId);
    try {
      const [row] = await this.db.insert(projectDocuments).values({ ...input, projectId }).returning();
      return row;
    } catch (err) {
      if (isForeignKeyViolation(err)) throw new BadRequestException('Employee not found');
      throw err;
    }
  }

  async remove(id: string): Promise<void> {
    const [row] = await this.db.delete(projectDocuments).where(eq(projectDocuments.id, id)).returning({ id: projectDocuments.id });
    if (!row) throw new NotFoundException('Document not found');
  }
}
