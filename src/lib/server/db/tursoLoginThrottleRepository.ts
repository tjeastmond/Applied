import type { Client } from "@tursodatabase/serverless/compat";
import type { LoginThrottleRecord, LoginThrottleRepository } from "@/lib/server/repositories/loginThrottleRepository";
import {
  CLEAR_LOGIN_THROTTLE_SQL,
  GET_LOGIN_THROTTLE_SQL,
  PRUNE_LOGIN_THROTTLE_SQL,
  RECORD_LOGIN_FAILURE_SQL,
} from "./loginThrottleRepositoryShared";
import { tursoFirstRow } from "./tursoRowHelpers";

export class TursoLoginThrottleRepository implements LoginThrottleRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async get(key: string): Promise<LoginThrottleRecord | null> {
    await this.ready;
    const row = await tursoFirstRow(this.client, GET_LOGIN_THROTTLE_SQL, [key]);
    if (!row) {
      return null;
    }
    return { failures: Number(row.failures), windowStartedAt: Number(row.window_started_at) };
  }

  async recordFailure(key: string, now: number, windowCutoff: number): Promise<void> {
    await this.ready;
    await this.client.execute({ sql: RECORD_LOGIN_FAILURE_SQL, args: [key, now, windowCutoff, windowCutoff] });
  }

  async clear(key: string): Promise<void> {
    await this.ready;
    await this.client.execute({ sql: CLEAR_LOGIN_THROTTLE_SQL, args: [key] });
  }

  async pruneExpired(windowCutoff: number): Promise<void> {
    await this.ready;
    await this.client.execute({ sql: PRUNE_LOGIN_THROTTLE_SQL, args: [windowCutoff] });
  }
}
