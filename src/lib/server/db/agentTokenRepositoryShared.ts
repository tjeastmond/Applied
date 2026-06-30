import { agentTokenPrefix } from "@/lib/server/hashAgentToken";
import type { Row } from "@tursodatabase/serverless/compat";
import type { AgentApiTokenSummary } from "@/types";
import { nullableString, requiredString } from "./tursoRowHelpers";

export const LIST_ACTIVE_SQL = `
  SELECT id, name, token_prefix, created_at, last_used_at
  FROM agent_api_tokens
  WHERE revoked_at IS NULL
  ORDER BY last_used_at IS NULL, last_used_at DESC, created_at DESC
`;

export const INSERT_TOKEN_SQL = `
  INSERT INTO agent_api_tokens (id, name, token_hash, token_prefix, created_at, revoked_at, last_used_at)
  VALUES (?, ?, ?, ?, ?, NULL, NULL)
`;

export const REVOKE_SQL = `
  UPDATE agent_api_tokens
  SET revoked_at = ?
  WHERE id = ? AND revoked_at IS NULL
`;

export const UPDATE_NAME_SQL = `
  UPDATE agent_api_tokens
  SET name = ?
  WHERE id = ? AND revoked_at IS NULL
`;

export const GET_BY_ID_SQL = `
  SELECT id, name, token_prefix, created_at, last_used_at
  FROM agent_api_tokens
  WHERE id = ? AND revoked_at IS NULL
  LIMIT 1
`;

export const IS_VALID_SQL = `
  SELECT 1 AS found
  FROM agent_api_tokens
  WHERE token_hash = ? AND revoked_at IS NULL
  LIMIT 1
`;

export const HAS_ACTIVE_SQL = `
  SELECT 1 AS found
  FROM agent_api_tokens
  WHERE revoked_at IS NULL
  LIMIT 1
`;

export const TOUCH_LAST_USED_SQL = `
  UPDATE agent_api_tokens
  SET last_used_at = ?
  WHERE token_hash = ? AND revoked_at IS NULL
`;

export type AgentApiTokenRow = {
  id: string;
  name: string;
  token_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

export function rowToAgentTokenSummary(row: AgentApiTokenRow): AgentApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.token_prefix,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
  };
}

export function agentTokenSummaryFromTursoRow(row: Row): AgentApiTokenSummary {
  return {
    id: requiredString(row, "id"),
    name: requiredString(row, "name"),
    tokenPrefix: requiredString(row, "token_prefix"),
    createdAt: requiredString(row, "created_at"),
    lastUsedAt: nullableString(row, "last_used_at"),
  };
}

export function buildAgentTokenRecord(
  id: string,
  name: string,
  rawToken: string,
  createdAt: string,
): AgentApiTokenSummary {
  return {
    id,
    name,
    tokenPrefix: agentTokenPrefix(rawToken),
    createdAt,
    lastUsedAt: null,
  };
}
