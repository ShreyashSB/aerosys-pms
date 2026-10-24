import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { HealthModule } from './health/health.module.js';

/** The root module: Nest starts here and wires every imported module together. */
@Module({
  imports: [ConfigModule, DbModule, HealthModule, ClientsModule],
})
export class AppModule {}
