import { DEFAULT_USER_DISPLAY_NAME, DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import type { User } from "@/types";
import { nowIso } from "./applicationRepositoryShared";

export type UserRow = {
  id: string;
  display_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
};

export const GET_USER_BY_ID_SQL = `SELECT id, display_name, email, created_at, updated_at FROM users WHERE id = ?`;
export const INSERT_DEFAULT_USER_SQL = `INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)`;

export function rowToUser(row: UserRow): User {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildDefaultUserInsertArgs(timestamp = nowIso()): [string, string, string, string] {
  return [DEFAULT_USER_ID, DEFAULT_USER_DISPLAY_NAME, timestamp, timestamp];
}
