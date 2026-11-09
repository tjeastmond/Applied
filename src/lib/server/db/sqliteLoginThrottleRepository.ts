import type Database from "better-sqlite3";
import type { LoginThrottleRecord, LoginThrottleRepository } from "@/lib/server/repositories/loginThrottleRepository";
import {
  CLEAR_LOGIN_THROTTLE_SQL,
  GET_LOGIN_THROTTLE_SQL,
  PRUNE_LOGIN_THROTTLE_SQL,
  RECORD_LOGIN_FAILURE_SQL,
} from "./loginThrottleRepositoryShared";

export class SqliteLoginThrottleRepository implements LoginThrottleRepository {
  constructor(private readonly db: Database.Database) {}

  get(key: string): LoginThrottleRecord | null {
    const row = this.db.prepare(GET_LOGIN_THROTTLE_SQL).get(key) as
      | { failures: number; window_started_at: number }
      | undefined;
    return row ? { failures: row.failures, windowStartedAt: row.window_started_at } : null;
  }

  recordFailure(key: string, now: number, windowCutoff: number): void {
    this.db.prepare(RECORD_LOGIN_FAILURE_SQL).run(key, now, windowCutoff, windowCutoff);
  }

  clear(key: string): void {
    this.db.prepare(CLEAR_LOGIN_THROTTLE_SQL).run(key);
  }

  pruneExpired(windowCutoff: number): void {
    this.db.prepare(PRUNE_LOGIN_THROTTLE_SQL).run(windowCutoff);
  }
}
