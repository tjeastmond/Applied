import type Database from "better-sqlite3";
import { generateAccessToken } from "@/lib/server/generateAccessToken";
import type { AppAccessConfigRepository } from "@/lib/server/repositories/appAccessConfigRepository";

const GET_TOKEN_SQL = `SELECT access_token FROM app_access_config WHERE id = 1`;
const INSERT_TOKEN_SQL = `INSERT INTO app_access_config (id, access_token, created_at, updated_at) VALUES (1, ?, ?, ?)`;

export class SqliteAppAccessConfigRepository implements AppAccessConfigRepository {
  constructor(private readonly db: Database.Database) {}

  getToken(): string | null {
    const row = this.db.prepare(GET_TOKEN_SQL).get() as { access_token: string } | undefined;
    const token = row?.access_token?.trim();
    return token && token.length > 0 ? token : null;
  }

  ensureToken(): string {
    const existing = this.getToken();
    if (existing) {
      return existing;
    }

    const token = generateAccessToken();
    const now = new Date().toISOString();
    this.db.prepare(INSERT_TOKEN_SQL).run(token, now, now);
    return token;
  }
}
