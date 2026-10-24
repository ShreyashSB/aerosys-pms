/**
 * Tiny localStorage-backed "database" that stands in for the backend.
 *
 * Every service in `src/services` goes through `db.read()` / `db.write()` and
 * `simulateLatency()`. To move to a real API, replace the service internals
 * with HTTP calls (see `src/api/http.ts`) – components never touch this file.
 */
import { buildSeed, DB_VERSION, type Database } from "./seed";

const STORAGE_KEY = "aerosys.db.v1";

let cache: Database | null = null;

function load(): Database {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version === DB_VERSION) {
        cache = parsed;
        return cache;
      }
    }
  } catch {
    // corrupted storage – fall through to reseed
  }
  cache = buildSeed();
  persist();
  return cache;
}

function persist() {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn("Could not persist demo data", err);
  }
}

export const db = {
  read(): Database {
    return load();
  },
  /** Apply a mutation to the database and persist it. */
  write<T>(mutator: (data: Database) => T): T {
    const data = load();
    const result = mutator(data);
    persist();
    return result;
  },
  reset() {
    cache = buildSeed();
    persist();
  },
};

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Mimic network round-trip so loading states are exercised during the demo. */
export function simulateLatency(min = 150, max = 450): Promise<void> {
  const ms = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Deep clone so callers can never mutate the store by reference. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}
