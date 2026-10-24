import { NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/db.module.js';
import { projects, type ProjectRow } from '../db/schema.js';

/** Loads a project row or answers 404. Shared by the modules that hang off a project. */
export async function findProject(db: Pick<Database, 'select'>, id: string): Promise<ProjectRow> {
  const [p] = await db.select().from(projects).where(eq(projects.id, id));
  if (!p) throw new NotFoundException('Project not found');
  return p;
}

export const isClosed = (p: Pick<ProjectRow, 'status'>) => p.status === 'completed' || p.status === 'archived';
