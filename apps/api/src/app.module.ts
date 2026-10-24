import { Module } from '@nestjs/common';
import { ClientsModule } from './clients/clients.module.js';
import { ConfigModule } from './config/config.module.js';
import { DbModule } from './db/db.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { HealthModule } from './health/health.module.js';
import { LookupsModule } from './lookups/lookups.module.js';
import { ProjectsModule } from './projects/projects.module.js';

/** The root module: Nest starts here and wires every imported module together. */
@Module({
  imports: [ConfigModule, DbModule, HealthModule, ClientsModule, LookupsModule, EmployeesModule, ProjectsModule],
})
export class AppModule {}
