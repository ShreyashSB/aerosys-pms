import { Body, Controller, Get, Post } from '@nestjs/common';
import { Allow } from '../auth/current-user.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import type { Client } from '../db/schema.js';
import { CreateClientSchema, type CreateClientDto } from './clients.dto.js';
import { ClientsService } from './clients.service.js';

/** Routes under /api/clients. Like a Spring @RestController. */
@Controller('clients')
export class ClientsController {
  // Nest sees ClientsService in the constructor and injects the shared instance.
  constructor(private readonly clients: ClientsService) {}

  /** GET /api/clients */
  @Get()
  list(): Promise<Client[]> {
    return this.clients.list();
  }

  /** POST /api/clients  { "name": "Tata Projects" } */
  @Allow('project.create')
  @Post()
  create(@Body(new ZodValidationPipe(CreateClientSchema)) body: CreateClientDto): Promise<Client> {
    return this.clients.create(body);
  }
}
