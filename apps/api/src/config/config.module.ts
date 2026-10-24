import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env.js';

export const ENV = Symbol('ENV');

/** Makes the validated environment injectable anywhere with `@Inject(ENV) env: Env`. */
@Global()
@Module({
  providers: [{ provide: ENV, useFactory: () => loadEnv() }],
  exports: [ENV],
})
export class ConfigModule {}
