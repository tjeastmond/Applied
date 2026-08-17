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

export type UserCredentialRow = {
  id: string;
  password_hash: string;
};

export const GET_USER_BY_ID_SQL = `SELECT id, display_name, email, created_at, updated_at FROM users WHERE id = ?`;
export const INSERT_DEFAULT_USER_SQL = `INSERT OR IGNORE INTO users (id, display_name, email, created_at, updated_at) VALUES (?, ?, NULL, ?, ?)`;
export const UPDATE_USER_PROFILE_SQL = `UPDATE users SET display_name = ?, email = ?, updated_at = ? WHERE id = ?`;
export const HAS_PASSWORD_LOGIN_SQL = `SELECT 1 AS found FROM users WHERE password_hash IS NOT NULL LIMIT 1`;
export const GET_CREDENTIAL_BY_EMAIL_SQL = `SELECT id, password_hash FROM users WHERE email = ? LIMIT 1`;
export const SET_OWNER_PASSWORD_SQL = `UPDATE users SET email = ?, password_hash = ?, display_name = COALESCE(?, display_name), updated_at = ? WHERE id = ? AND password_hash IS NULL`;
export const GET_CREDENTIAL_BY_ID_SQL = `SELECT id, password_hash FROM users WHERE id = ? LIMIT 1`;
export const UPDATE_PASSWORD_HASH_SQL = `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ? AND password_hash IS NOT NULL`;
export const IS_EMAIL_TAKEN_SQL = `SELECT 1 AS found FROM users WHERE email = ? AND id <> ? LIMIT 1`;

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

export type SetOwnerPasswordInput = {
  email: string;
  passwordHash: string;
  displayName?: string | null;
};
