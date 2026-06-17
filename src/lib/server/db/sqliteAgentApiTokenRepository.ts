import type Database from "better-sqlite3";
import { hashAgentToken, agentTokenPrefix } from "@/lib/server/hashAgentToken";
import { generateAccessToken } from "@/lib/server/generateAccessToken";
import type { AgentApiTokenRepository } from "@/lib/server/repositories/agentApiTokenRepository";
import type { AgentApiTokenSummary, CreateAgentApiTokenResult } from "@/types";

const LIST_ACTIVE_SQL = `
  SELECT id, name, token_prefix, created_at
  FROM agent_api_tokens
  WHERE revoked_at IS NULL
  ORDER BY created_at DESC
`;

const INSERT_TOKEN_SQL = `
  INSERT INTO agent_api_tokens (id, name, token_hash, token_prefix, created_at, revoked_at)
  VALUES (?, ?, ?, ?, ?, NULL)
`;

const REVOKE_SQL = `
  UPDATE agent_api_tokens
  SET revoked_at = ?
  WHERE id = ? AND revoked_at IS NULL
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

function rowToSummary(row: {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
}): AgentApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    createdAt: row.created_at,
  };
}

export class SqliteAgentApiTokenRepository implements AgentApiTokenRepository {
  constructor(private readonly db: Database.Database) {}

  listActive(): AgentApiTokenSummary[] {
    const rows = this.db.prepare(LIST_ACTIVE_SQL).all() as {
      id: string;
      name: string;
      token_prefix: string;
      created_at: string;
    }[];
    return rows.map(rowToSummary);
  }

  create(name: string): CreateAgentApiTokenResult {
    const token = generateAccessToken();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    this.db
      .prepare(INSERT_TOKEN_SQL)
      .run(id, name, hashAgentToken(token), agentTokenPrefix(token), createdAt);

    return {
      token,
      record: {
        id,
        name,
        tokenPrefix: agentTokenPrefix(token),
        createdAt,
      },
    };
  }

  revoke(id: string): boolean {
    const result = this.db.prepare(REVOKE_SQL).run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  isValidToken(rawToken: string): boolean {
    const row = this.db.prepare(IS_VALID_SQL).get(hashAgentToken(rawToken));
    return row !== undefined;
  }

  hasActiveTokens(): boolean {
    const row = this.db.prepare(HAS_ACTIVE_SQL).get();
    return row !== undefined;
  }
}
