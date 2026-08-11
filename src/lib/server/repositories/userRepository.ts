import type { UpdateUserProfileInput } from "@/lib/schemas/user";
import type { User } from "@/types";

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  ensureDefaultUser(): Promise<User>;
  updateProfile(id: string, input: UpdateUserProfileInput): Promise<User | null>;
}
