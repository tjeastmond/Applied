import type Database from "better-sqlite3";
import type { User } from "@/types";
import type { UserRepository } from "../repositories/userRepository";
import type { UpdateUserProfileInput } from "@/lib/schemas/user";
import {
  buildDefaultUserInsertArgs,
  GET_USER_BY_ID_SQL,
  INSERT_DEFAULT_USER_SQL,
  rowToUser,
  UPDATE_USER_PROFILE_SQL,
  type UserRow,
} from "./userRepositoryShared";
import { nowIso } from "./applicationRepositoryShared";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";

export class SqliteUserRepository implements UserRepository {
  private readonly getByIdStmt;
  private readonly insertDefaultUserStmt;
  private readonly updateProfileStmt;

  constructor(db: Database.Database) {
    this.getByIdStmt = db.prepare(GET_USER_BY_ID_SQL);
    this.insertDefaultUserStmt = db.prepare(INSERT_DEFAULT_USER_SQL);
    this.updateProfileStmt = db.prepare(UPDATE_USER_PROFILE_SQL);
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
    const result = this.updateProfileStmt.run(input.displayName, input.email, updatedAt, id);
    if (result.changes === 0) {
      return null;
    }
    return this.getById(id);
  }
}
