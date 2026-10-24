import { Inject, Injectable } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';
import { DB, type Database } from '../db/db.module.js';
import { clients, type Client } from '../db/schema.js';
import type { CreateClientDto } from './clients.dto.js';

/**
 * Services hold the business logic and talk to the database.
 * Controllers stay thin: they only translate HTTP to a service call.
 */
@Injectable()
export class ClientsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  list(): Promise<Client[]> {
    return this.db.select().from(clients).orderBy(asc(clients.name));
  }

  /**
   * "Add new" is safe to click twice: if a client with the same name already
   * exists (ignoring case), that client is returned instead of a duplicate.
   */
  async create(input: CreateClientDto): Promise<Client> {
    const [existing] = await this.db
      .select()
      .from(clients)
      .where(sql`lower(${clients.name}) = lower(${input.name})`)
      .limit(1);
    if (existing) return existing;

    const [created] = await this.db.insert(clients).values({ name: input.name }).returning();
    return created;
  }
}
