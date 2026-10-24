# 03 — NestJS

NestJS is a backend framework for Node.js that borrows its structure from Angular and Spring: **modules**, **dependency injection**, and **decorators** on classes. If you have written a Spring Boot REST API, you already know the shape.

## Spring Boot to NestJS

| Spring Boot | NestJS | In this repo |
| --- | --- | --- |
| `@SpringBootApplication` + `main()` | `NestFactory.create(AppModule)` | `apps/api/src/main.ts` |
| `@Configuration` / component scan | `@Module({ imports, controllers, providers })` (explicit, no scanning) | `app.module.ts`, `clients/clients.module.ts` |
| `@RestController` + `@RequestMapping("/clients")` | `@Controller('clients')` | `clients/clients.controller.ts` |
| `@GetMapping`, `@PostMapping` | `@Get()`, `@Post()` | same file |
| `@RequestBody` | `@Body()` | same file |
| `@Service` / `@Component` | `@Injectable()` | `clients/clients.service.ts` |
| Constructor injection | Constructor injection (same idea) | `constructor(private readonly clients: ClientsService)` |
| `@Bean` method | A provider with `useFactory` | `db/db.module.ts` |
| `@Qualifier("db")` | An injection token: `@Inject(DB)` | `health/health.controller.ts` |
| Bean Validation (`@Valid`, `@NotBlank`) | A **pipe** with a Zod schema | `common/zod-validation.pipe.ts`, `clients/clients.dto.ts` |
| `application.properties` | Environment variables, checked by Zod at startup | `config/env.ts` |
| `@ControllerAdvice` | Exception filters (later) | |
| Spring Security filters | Guards (coming with login and roles) | |
| JUnit + MockMvc | Vitest + `@nestjs/testing` + supertest | `src/**/*.spec.ts`, `test/api.e2e-spec.ts` |

## The pieces, using the clients feature

```
clients/
  clients.module.ts      groups the feature: which controller, which providers
  clients.controller.ts  HTTP only: routes, reads the body, calls the service
  clients.service.ts     the logic and the database calls
  clients.dto.ts         the request shape, as a Zod schema + its TypeScript type
```

**Module.** `@Module({ controllers: [ClientsController], providers: [ClientsService] })`. Nest only knows about classes listed in a module. `AppModule` imports every feature module.

**Controller.**

```ts
@Controller('clients')                 // with the global prefix: /api/clients
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}   // injected

  @Post()
  create(@Body(new ZodValidationPipe(CreateClientSchema)) body: CreateClientDto) {
    return this.clients.create(body);   // returned object becomes JSON, status 201
  }
}
```

**Service.** `@Injectable()` marks it for injection. One shared instance (a singleton), like a Spring bean.

**Validation with Zod.** `clients.dto.ts` declares the rules once:

```ts
export const CreateClientSchema = z.object({ name: z.string().trim().min(2).max(120) });
export type CreateClientDto = z.infer<typeof CreateClientSchema>;  // the type comes from the rules
```

The pipe runs before the controller method and answers 400 with field errors if the body is wrong.

**Global modules.** `ConfigModule` and `DbModule` are marked `@Global()`, so any service can inject `ENV` or `DB` without importing them, like a bean available everywhere.

## Async in TypeScript (vs Java)

Database calls return a `Promise`, the TypeScript version of `CompletableFuture`. `await` waits for it without blocking the server, so one Node process can serve many requests at once. Methods that await are marked `async`.

## Run and test

```bash
pnpm dev:api                                   # starts with live reload on :3000
pnpm --filter @aerosys/api test                # unit tests (no database)
pnpm --filter @aerosys/api test:e2e            # real app + real Postgres (needs DATABASE_URL)
```

## Exercise: add GET /api/project-types

1. Create `apps/api/src/project-types/project-types.service.ts` with a `list()` that returns `this.db.select().from(projectTypes)`.
2. Create `project-types.controller.ts` with `@Controller('project-types')` and a `@Get()` that calls the service.
3. Create `project-types.module.ts` listing both, and add it to `imports` in `app.module.ts`.
4. Run `curl localhost:3000/api/project-types`. You should see the five types seeded by migration `0001_seed_project_types.sql`.
