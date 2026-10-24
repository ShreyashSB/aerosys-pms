import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import { Allow, User, type CurrentUser } from '../auth/current-user.js';
import { ReadScopeService } from '../auth/read-scope.js';
import { ProjectScope } from '../auth/project-access.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { DailyLogInputSchema, type DailyLogDto, type DailyLogInput } from './daily-logs.dto.js';
import { DailyLogsService } from './daily-logs.service.js';

@Controller()
export class DailyLogsController {
  constructor(
    private readonly logs: DailyLogsService,
    private readonly scopes: ReadScopeService,
  ) {}

  /** GET /api/daily-logs?projectId=… */
  @Get('daily-logs')
  async list(@User() user: CurrentUser, @Query('projectId', new ParseUUIDPipe({ optional: true })) projectId?: string): Promise<DailyLogDto[]> {
    return (await this.scopes.for(user)).filter(await this.logs.list(projectId));
  }

  /** GET /api/daily-logs/:id */
  @Get('daily-logs/:id')
  async get(@User() user: CurrentUser, @Param('id', ParseUUIDPipe) id: string): Promise<DailyLogDto> {
    const log = await this.logs.get(id);
    (await this.scopes.for(user)).assertSees(log.projectId, 'Daily log');
    return log;
  }

  /** POST /api/projects/:projectId/daily-logs */
  @Allow('log.create')
  @ProjectScope('projectId', 'projects')
  @Post('projects/:projectId/daily-logs')
  create(
    @User() user: CurrentUser,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodValidationPipe(DailyLogInputSchema)) body: DailyLogInput,
  ): Promise<DailyLogDto> {
    return this.logs.create(projectId, body, user.employeeId);
  }

  /** PUT /api/daily-logs/:id */
  @Allow('log.create')
  @ProjectScope('id', 'dailyLogs')
  @Put('daily-logs/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(DailyLogInputSchema)) body: DailyLogInput): Promise<DailyLogDto> {
    return this.logs.update(id, body);
  }

  /** DELETE /api/daily-logs/:id (204) */
  @Allow('log.create')
  @ProjectScope('id', 'dailyLogs')
  @Delete('daily-logs/:id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.logs.remove(id);
  }
}
