import type { Client, InValue, Row } from "@tursodatabase/serverless/compat";
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
  SELECT 1 AS found
  FROM agent_api_tokens
  WHERE token_hash = ? AND revoked_at IS NULL
  LIMIT 1
`;

const HAS_ACTIVE_SQL = `
  SELECT 1 AS found
  FROM agent_api_tokens
  WHERE revoked_at IS NULL
  LIMIT 1
`;

const TOUCH_LAST_USED_SQL = `
  UPDATE agent_api_tokens
  SET last_used_at = ?
  WHERE token_hash = ? AND revoked_at IS NULL
`;

function requiredString(row: Row, column: string): string {
  const value = row[column];
  if (value === null || value === undefined) {
    throw new Error(`Missing required database column: ${column}`);
  }
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "bigint" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  throw new Error(`Unsupported value for database column: ${column}`);
}

function nullableString(row: Row, column: string): string | null {
  const value = row[column];
  if (value === null || value === undefined) return null;
  return requiredString(row, column);
}

function rowToSummary(row: Row): AgentApiTokenSummary {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    tokenPrefix: requiredString(row, "token_prefix"),
    createdAt: requiredString(row, "created_at"),
    lastUsedAt: nullableString(row, "last_used_at"),
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

async function rows(client: Client, sql: string, args?: InValue[]): Promise<Row[]> {
  const result = args === undefined ? await client.execute(sql) : await client.execute({ sql, args });
  return result.rows;
}

async function firstRow(client: Client, sql: string, args?: InValue[]): Promise<Row | null> {
  const result = await rows(client, sql, args);
  return result[0] ?? null;
}

export class TursoAgentApiTokenRepository implements AgentApiTokenRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async listActive(): Promise<AgentApiTokenSummary[]> {
    await this.ready;
    return (await rows(this.client, LIST_ACTIVE_SQL)).map(rowToSummary);
  }

  async create(name: string): Promise<CreateAgentApiTokenResult> {
    await this.ready;
    const token = generateAccessToken();
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await this.client.execute({
      sql: INSERT_TOKEN_SQL,
      args: [id, name, hashAgentToken(token), agentTokenPrefix(token), createdAt],
    });

    return {
      token,
      record: buildRecord(id, name, token, createdAt),
    };
  }

  async importFromRawToken(name: string, rawToken: string): Promise<ImportAgentApiTokenResult> {
    await this.ready;
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await this.client.execute({
      sql: INSERT_TOKEN_SQL,
      args: [id, name, hashAgentToken(rawToken), agentTokenPrefix(rawToken), createdAt],
    });

    return {
      record: buildRecord(id, name, rawToken, createdAt),
    };
  }

  async revoke(id: string): Promise<boolean> {
    await this.ready;
    const result = await this.client.execute({
      sql: REVOKE_SQL,
      args: [new Date().toISOString(), id],
    });
    return result.rowsAffected > 0;
  }

  async updateName(id: string, name: string): Promise<AgentApiTokenSummary | null> {
    await this.ready;
    const result = await this.client.execute({
      sql: UPDATE_NAME_SQL,
      args: [name, id],
    });
    if (result.rowsAffected === 0) {
      return null;
    }

    const row = await firstRow(this.client, GET_BY_ID_SQL, [id]);
    return row ? rowToSummary(row) : null;
  }

  async isValidToken(rawToken: string): Promise<boolean> {
    return this.hasActiveTokenWithHash(rawToken);
  }

  async hasActiveTokens(): Promise<boolean> {
    await this.ready;
    const row = await firstRow(this.client, HAS_ACTIVE_SQL);
    return row !== null;
  }

  async hasActiveTokenWithHash(rawToken: string): Promise<boolean> {
    await this.ready;
    const row = await firstRow(this.client, IS_VALID_SQL, [hashAgentToken(rawToken)]);
    return row !== null;
  }

  async touchLastUsed(rawToken: string): Promise<void> {
    await this.ready;
    await this.client.execute({
      sql: TOUCH_LAST_USED_SQL,
      args: [new Date().toISOString(), hashAgentToken(rawToken)],
    });
  }
}
