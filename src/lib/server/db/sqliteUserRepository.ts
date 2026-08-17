import type Database from "better-sqlite3";
import type { User } from "@/types";
import type { UserRepository, UserCredential } from "../repositories/userRepository";
import type { UpdateUserProfileInput } from "@/lib/schemas/user";
import {
  buildDefaultUserInsertArgs,
  GET_CREDENTIAL_BY_EMAIL_SQL,
  GET_CREDENTIAL_BY_ID_SQL,
  GET_USER_BY_ID_SQL,
  HAS_PASSWORD_LOGIN_SQL,
  INSERT_DEFAULT_USER_SQL,
  IS_EMAIL_TAKEN_SQL,
  rowToUser,
  SET_OWNER_PASSWORD_SQL,
  UPDATE_PASSWORD_HASH_SQL,
  UPDATE_USER_PROFILE_SQL,
  type SetOwnerPasswordInput,
  type UserCredentialRow,
  type UserRow,
} from "./userRepositoryShared";
import { nowIso } from "./applicationRepositoryShared";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";

export class SqliteUserRepository implements UserRepository {
  private readonly getByIdStmt;
  private readonly insertDefaultUserStmt;
  private readonly updateProfileStmt;
  private readonly hasPasswordLoginStmt;
  private readonly getCredentialByEmailStmt;
  private readonly getCredentialByIdStmt;
  private readonly setOwnerPasswordStmt;
  private readonly updatePasswordHashStmt;
  private readonly isEmailTakenStmt;

  constructor(db: Database.Database) {
    this.getByIdStmt = db.prepare(GET_USER_BY_ID_SQL);
    this.insertDefaultUserStmt = db.prepare(INSERT_DEFAULT_USER_SQL);
    this.updateProfileStmt = db.prepare(UPDATE_USER_PROFILE_SQL);
    this.hasPasswordLoginStmt = db.prepare(HAS_PASSWORD_LOGIN_SQL);
    this.getCredentialByEmailStmt = db.prepare(GET_CREDENTIAL_BY_EMAIL_SQL);
    this.getCredentialByIdStmt = db.prepare(GET_CREDENTIAL_BY_ID_SQL);
    this.setOwnerPasswordStmt = db.prepare(SET_OWNER_PASSWORD_SQL);
    this.updatePasswordHashStmt = db.prepare(UPDATE_PASSWORD_HASH_SQL);
    this.isEmailTakenStmt = db.prepare(IS_EMAIL_TAKEN_SQL);
  }

  getById(id: string): Promise<User | null> {
    const row = this.getByIdStmt.get(id) as UserRow | undefined;
    return Promise.resolve(row ? rowToUser(row) : null);
  }

  async ensureDefaultUser(): Promise<User> {
    this.insertDefaultUserStmt.run(...buildDefaultUserInsertArgs());
    const user = await this.getById(DEFAULT_USER_ID);
    if (!user) {
      throw new Error("Failed to ensure default user");
    }
    return user;
  }

  async updateProfile(id: string, input: UpdateUserProfileInput): Promise<User | null> {
    const updatedAt = nowIso();
    const email = input.email?.toLowerCase() ?? null;
    const result = this.updateProfileStmt.run(input.displayName, email, updatedAt, id);
    if (result.changes === 0) {
      return null;
    }
    return this.getById(id);
  }

  hasPasswordLogin(): Promise<boolean> {
    const row = this.hasPasswordLoginStmt.get() as { found: number } | undefined;
    return Promise.resolve(row !== undefined);
  }

  getCredentialByEmail(email: string): Promise<UserCredential | null> {
    const row = this.getCredentialByEmailStmt.get(email.toLowerCase()) as UserCredentialRow | undefined;
    if (!row) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ id: row.id, passwordHash: row.password_hash });
  }

  getCredentialById(id: string): Promise<UserCredential | null> {
    const row = this.getCredentialByIdStmt.get(id) as UserCredentialRow | undefined;
    if (!row) {
      return Promise.resolve(null);
    }
    return Promise.resolve({ id: row.id, passwordHash: row.password_hash });
  }

  setOwnerPassword(input: SetOwnerPasswordInput): Promise<boolean> {
    const updatedAt = nowIso();
    const result = this.setOwnerPasswordStmt.run(
      input.email.toLowerCase(),
      input.passwordHash,
      input.displayName ?? null,
      updatedAt,
      DEFAULT_USER_ID,
    );
    return Promise.resolve(result.changes > 0);
  }

  updatePasswordHash(userId: string, passwordHash: string): Promise<boolean> {
    const updatedAt = nowIso();
    const result = this.updatePasswordHashStmt.run(passwordHash, updatedAt, userId);
    return Promise.resolve(result.changes > 0);
  }

  isEmailTaken(email: string, excludeUserId: string): Promise<boolean> {
    const row = this.isEmailTakenStmt.get(email.toLowerCase(), excludeUserId) as { found: number } | undefined;
    return Promise.resolve(row !== undefined);
  }
}
