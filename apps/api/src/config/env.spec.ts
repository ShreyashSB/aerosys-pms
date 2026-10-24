import { loadEnv } from './env.js';

describe('loadEnv', () => {
  it('applies defaults when only DATABASE_URL is set', () => {
    const env = loadEnv({ DATABASE_URL: 'postgresql://localhost/db' });
    expect(env.PORT).toBe(3000);
    expect(env.MIGRATE_ON_START).toBe(false);
    expect(env.WEB_ORIGIN).toBe('http://localhost:5173');
  });

  it('fails fast with a readable message when DATABASE_URL is missing', () => {
    expect(() => loadEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses to start in production without a long JWT_SECRET', () => {
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://localhost/db', NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
    expect(() => loadEnv({ DATABASE_URL: 'postgresql://localhost/db', NODE_ENV: 'production', JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
    const env = loadEnv({ DATABASE_URL: 'postgresql://localhost/db', NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(48) });
    expect(env.JWT_EXPIRES_IN).toBe('12h');
  });
});
