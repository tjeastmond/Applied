import type Database from "better-sqlite3";
import { hashAgentToken, agentTokenPrefix } from "@/lib/server/hashAgentToken";
import { generateAccessToken } from "@/lib/server/generateAccessToken";
import type { AgentApiTokenRepository } from "@/lib/server/repositories/agentApiTokenRepository";
import type { CreateAgentApiTokenResult, ImportAgentApiTokenResult } from "@/types";
import {
  buildAgentTokenRecord,
  GET_BY_ID_SQL,
  HAS_ACTIVE_SQL,
  INSERT_TOKEN_SQL,
  IS_VALID_SQL,
  LIST_ACTIVE_SQL,
  REVOKE_SQL,
  TOUCH_LAST_USED_SQL,
  UPDATE_NAME_SQL,
  type AgentApiTokenRow,
  rowToAgentTokenSummary,
} from "./agentTokenRepositoryShared";

export class SqliteAgentApiTokenRepository implements AgentApiTokenRepository {
  constructor(private readonly db: Database.Database) {}

  listActive() {
    const rows = this.db.prepare(LIST_ACTIVE_SQL).all() as AgentApiTokenRow[];
    return rows.map(rowToAgentTokenSummary);
  }

  create(name: string): CreateAgentApiTokenResult {
    const token = generateAccessToken();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.prepare(INSERT_TOKEN_SQL).run(id, name, hashAgentToken(token), agentTokenPrefix(token), createdAt);

    return {
      token,
      record: buildAgentTokenRecord(id, name, token, createdAt),
    };
  }

  importFromRawToken(name: string, rawToken: string): ImportAgentApiTokenResult {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.prepare(INSERT_TOKEN_SQL).run(id, name, hashAgentToken(rawToken), agentTokenPrefix(rawToken), createdAt);

    return {
      record: buildAgentTokenRecord(id, name, rawToken, createdAt),
    };
  }

  revoke(id: string): boolean {
    const result = this.db.prepare(REVOKE_SQL).run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  updateName(id: string, name: string) {
    const result = this.db.prepare(UPDATE_NAME_SQL).run(name, id);
    if (result.changes === 0) {
      return null;
    }

    const row = this.db.prepare(GET_BY_ID_SQL).get(id) as AgentApiTokenRow | undefined;
    return row ? rowToAgentTokenSummary(row) : null;
  }

  isValidToken(rawToken: string): boolean {
    return this.hasActiveTokenWithHash(rawToken);
  }

  hasActiveTokens(): boolean {
    const row = this.db.prepare(HAS_ACTIVE_SQL).get();
    return row !== undefined;
  }

  hasActiveTokenWithHash(rawToken: string): boolean {
    const row = this.db.prepare(IS_VALID_SQL).get(hashAgentToken(rawToken));
    return row !== undefined;
  }

  touchLastUsed(rawToken: string): void {
    this.db.prepare(TOUCH_LAST_USED_SQL).run(new Date().toISOString(), hashAgentToken(rawToken));
  }
}
