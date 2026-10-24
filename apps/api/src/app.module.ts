import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { AssignmentsModule } from './assignments/assignments.module.js';
import { BillsModule } from './bills/bills.module.js';
import { BoqModule } from './boq/boq.module.js';
import { ClientsModule } from './clients/clients.module.js';
import { ConfigModule } from './config/config.module.js';
import { DailyLogsModule } from './daily-logs/daily-logs.module.js';
import { DbModule } from './db/db.module.js';
import { DocumentsModule } from './documents/documents.module.js';
import { EmployeesModule } from './employees/employees.module.js';
import { ExpensesModule } from './expenses/expenses.module.js';
import { HealthModule } from './health/health.module.js';
import { InstrumentsModule } from './instruments/instruments.module.js';
import { LookupsModule } from './lookups/lookups.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ProjectCostsModule } from './project-costs/project-costs.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { SettingsModule } from './settings/settings.module.js';
import { UsersModule } from './users/users.module.js';

/** The root module: Nest starts here and wires every imported module together. */
@Module({
  imports: [
    ConfigModule,
    DbModule,
    AuthModule,
    NotificationsModule,
    UsersModule,
    HealthModule,
    SettingsModule,
    ClientsModule,
    LookupsModule,
    EmployeesModule,
    ProjectsModule,
    AssignmentsModule,
    BoqModule,
    DailyLogsModule,
    ExpensesModule,
    BillsModule,
    ProjectCostsModule,
    InstrumentsModule,
    DocumentsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
