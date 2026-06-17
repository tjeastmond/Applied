import type { Client, InValue, Row } from "@tursodatabase/serverless/compat";
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

function rowToSummary(row: Row): AgentApiTokenSummary {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    tokenPrefix: requiredString(row, "token_prefix"),
    createdAt: requiredString(row, "created_at"),
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
      record: {
        id,
        name,
        tokenPrefix: agentTokenPrefix(token),
        createdAt,
      },
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

  async isValidToken(rawToken: string): Promise<boolean> {
    await this.ready;
    const row = await firstRow(this.client, IS_VALID_SQL, [hashAgentToken(rawToken)]);
    return row !== null;
  }

  async hasActiveTokens(): Promise<boolean> {
    await this.ready;
    const row = await firstRow(this.client, HAS_ACTIVE_SQL);
    return row !== null;
  }
}
