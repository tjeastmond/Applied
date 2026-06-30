import type { Client } from "@tursodatabase/serverless/compat";
import { hashAgentToken, agentTokenPrefix } from "@/lib/server/hashAgentToken";
import { generateAccessToken } from "@/lib/server/generateAccessToken";
import type { AgentApiTokenRepository } from "@/lib/server/repositories/agentApiTokenRepository";
import type { CreateAgentApiTokenResult, ImportAgentApiTokenResult } from "@/types";
import {
  agentTokenSummaryFromTursoRow,
  buildAgentTokenRecord,
  GET_BY_ID_SQL,
  HAS_ACTIVE_SQL,
  INSERT_TOKEN_SQL,
  IS_VALID_SQL,
  LIST_ACTIVE_SQL,
  REVOKE_SQL,
  TOUCH_LAST_USED_SQL,
  UPDATE_NAME_SQL,
} from "./agentTokenRepositoryShared";
import { tursoFirstRow, tursoRows } from "./tursoRowHelpers";

export class TursoAgentApiTokenRepository implements AgentApiTokenRepository {
  constructor(
    private readonly client: Client,
    private readonly ready: Promise<void>,
  ) {}

  async listActive() {
    await this.ready;
    return (await tursoRows(this.client, LIST_ACTIVE_SQL)).map(agentTokenSummaryFromTursoRow);
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
      record: buildAgentTokenRecord(id, name, token, createdAt),
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
      record: buildAgentTokenRecord(id, name, rawToken, createdAt),
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

  async updateName(id: string, name: string) {
    await this.ready;
    const result = await this.client.execute({
      sql: UPDATE_NAME_SQL,
      args: [name, id],
    });
    if (result.rowsAffected === 0) {
      return null;
    }

    const row = await tursoFirstRow(this.client, GET_BY_ID_SQL, [id]);
    return row ? agentTokenSummaryFromTursoRow(row) : null;
  }

  async isValidToken(rawToken: string): Promise<boolean> {
    return this.hasActiveTokenWithHash(rawToken);
  }

  async hasActiveTokens(): Promise<boolean> {
    await this.ready;
    const row = await tursoFirstRow(this.client, HAS_ACTIVE_SQL);
    return row !== null;
  }

  async hasActiveTokenWithHash(rawToken: string): Promise<boolean> {
    await this.ready;
    const row = await tursoFirstRow(this.client, IS_VALID_SQL, [hashAgentToken(rawToken)]);
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
