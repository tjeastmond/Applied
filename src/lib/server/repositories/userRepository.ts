import type { UpdateUserProfileInput } from "@/lib/schemas/user";
import type { User } from "@/types";
import type { SetOwnerPasswordInput } from "../db/userRepositoryShared";

export type UserCredential = {
  id: string;
  passwordHash: string;
};

export interface UserRepository {
  getById(id: string): Promise<User | null>;
  ensureDefaultUser(): Promise<User>;
  updateProfile(id: string, input: UpdateUserProfileInput): Promise<User | null>;
  hasPasswordLogin(): Promise<boolean>;
  getCredentialByEmail(email: string): Promise<UserCredential | null>;
  getCredentialById(id: string): Promise<UserCredential | null>;
  setOwnerPassword(input: SetOwnerPasswordInput): Promise<boolean>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<boolean>;
  isEmailTaken(email: string, excludeUserId: string): Promise<boolean>;
}
