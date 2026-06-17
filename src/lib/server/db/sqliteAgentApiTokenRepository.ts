import type Database from "better-sqlite3";
import { hashAgentToken, agentTokenPrefix } from "@/lib/server/hashAgentToken";
import { generateAccessToken } from "@/lib/server/generateAccessToken";
import type { AgentApiTokenRepository } from "@/lib/server/repositories/agentApiTokenRepository";
import type { AgentApiTokenSummary, CreateAgentApiTokenResult, ImportAgentApiTokenResult } from "@/types";

const LIST_ACTIVE_SQL = `
  SELECT id, name, token_prefix, created_at, last_used_at
  FROM agent_api_tokens
  WHERE revoked_at IS NULL
  ORDER BY last_used_at IS NULL, last_used_at DESC, created_at DESC
`;

const INSERT_TOKEN_SQL = `
  INSERT INTO agent_api_tokens (id, name, token_hash, token_prefix, created_at, revoked_at, last_used_at)
  VALUES (?, ?, ?, ?, ?, NULL, NULL)
`;

const REVOKE_SQL = `
  UPDATE agent_api_tokens
  SET revoked_at = ?
  WHERE id = ? AND revoked_at IS NULL
`;

const UPDATE_NAME_SQL = `
  UPDATE agent_api_tokens
  SET name = ?
  WHERE id = ? AND revoked_at IS NULL
`;

const GET_BY_ID_SQL = `
  SELECT id, name, token_prefix, created_at, last_used_at
  FROM agent_api_tokens
  WHERE id = ? AND revoked_at IS NULL
  LIMIT 1
`;

const IS_VALID_SQL = `
  SELECT 1
  FROM agent_api_tokens
  WHERE token_hash = ? AND revoked_at IS NULL
  LIMIT 1
`;

const HAS_ACTIVE_SQL = `
  SELECT 1
  FROM agent_api_tokens
  WHERE revoked_at IS NULL
  LIMIT 1
`;

const TOUCH_LAST_USED_SQL = `
  UPDATE agent_api_tokens
  SET last_used_at = ?
  WHERE token_hash = ? AND revoked_at IS NULL
`;

type AgentApiTokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

function rowToSummary(row: AgentApiTokenRow): AgentApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

function buildRecord(id: string, name: string, rawToken: string, createdAt: string): AgentApiTokenSummary {
  return {
    id,
    name,
    tokenPrefix: agentTokenPrefix(rawToken),
    createdAt,
    lastUsedAt: null,
  };
}

export class SqliteAgentApiTokenRepository implements AgentApiTokenRepository {
  constructor(private readonly db: Database.Database) {}

  listActive(): AgentApiTokenSummary[] {
    const rows = this.db.prepare(LIST_ACTIVE_SQL).all() as AgentApiTokenRow[];
    return rows.map(rowToSummary);
  }

  create(name: string): CreateAgentApiTokenResult {
    const token = generateAccessToken();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.prepare(INSERT_TOKEN_SQL).run(id, name, hashAgentToken(token), agentTokenPrefix(token), createdAt);

    return {
      token,
      record: buildRecord(id, name, token, createdAt),
    };
  }

  importFromRawToken(name: string, rawToken: string): ImportAgentApiTokenResult {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db.prepare(INSERT_TOKEN_SQL).run(id, name, hashAgentToken(rawToken), agentTokenPrefix(rawToken), createdAt);

    return {
      record: buildRecord(id, name, rawToken, createdAt),
    };
  }

  revoke(id: string): boolean {
    const result = this.db.prepare(REVOKE_SQL).run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  updateName(id: string, name: string): AgentApiTokenSummary | null {
    const result = this.db.prepare(UPDATE_NAME_SQL).run(name, id);
    if (result.changes === 0) {
      return null;
    }

    const row = this.db.prepare(GET_BY_ID_SQL).get(id) as AgentApiTokenRow | undefined;
    return row ? rowToSummary(row) : null;
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
