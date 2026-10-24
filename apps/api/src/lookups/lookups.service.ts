import { Inject, Injectable } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { clients, projectTypes, sites } from '../db/schema.js';

/** Any of the three name-only lookup tables. */
type LookupTable = typeof clients | typeof sites | typeof projectTypes;

/** Either the app's database or an open transaction: both run the same queries. */
export type Executor = Pick<Database, 'select' | 'insert'>;

export interface Lookups {
  clients: string[];
  sites: string[];
  projectTypes: string[];
}

/**
 * The dropdown lists for the project form. "Add new" in the form sends a plain
 * name; `findOrCreate` turns it into a row id, reusing an existing row when
 * the name matches ignoring case, so "tata projects" never duplicates "Tata Projects".
 */
@Injectable()
export class LookupsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(): Promise<Lookups> {
    const names = (t: LookupTable) => this.db.select({ name: t.name }).from(t).orderBy(asc(t.name));
    const [c, s, t] = await Promise.all([names(clients), names(sites), names(projectTypes)]);
    return { clients: c.map((r) => r.name), sites: s.map((r) => r.name), projectTypes: t.map((r) => r.name) };
  }

  async findOrCreate(table: LookupTable, name: string, tx: Executor = this.db): Promise<string> {
    const trimmed = name.trim();
    const [existing] = await tx
      .select({ id: table.id })
      .from(table)
      .where(sql`lower(${table.name}) = lower(${trimmed})`)
      .limit(1);
    if (existing) return existing.id;
    // ON CONFLICT covers two people adding the same new name at the same moment.
    const [created] = await tx
      .insert(table)
      .values({ name: trimmed })
      .onConflictDoUpdate({ target: table.name, set: { name: trimmed } })
      .returning({ id: table.id });
    return created.id;
  }
}
