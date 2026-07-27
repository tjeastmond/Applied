import type Database from "better-sqlite3";
import type { User } from "@/types";
import type { UserRepository } from "../repositories/userRepository";
import {
  buildDefaultUserInsertArgs,
  GET_USER_BY_ID_SQL,
  INSERT_DEFAULT_USER_SQL,
  rowToUser,
  type UserRow,
} from "./userRepositoryShared";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";

export class SqliteUserRepository implements UserRepository {
  private readonly getByIdStmt;
  private readonly insertDefaultUserStmt;

  constructor(db: Database.Database) {
    this.getByIdStmt = db.prepare(GET_USER_BY_ID_SQL);
    this.insertDefaultUserStmt = db.prepare(INSERT_DEFAULT_USER_SQL);
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
}
