import type { User } from "@/types";

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  ensureDefaultUser(): Promise<User>;
}
