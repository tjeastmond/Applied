import { getUserRepository } from "@/lib/server/db";
import type { User } from "@/types";

/** Resolve the profile user for writes until per-user sessions exist. */
export async function resolveCurrentUser(): Promise<User> {
  return getUserRepository().ensureDefaultUser();
}

/** Resolve the acting user for writes until per-user sessions exist. */
export async function resolveCurrentUserId(): Promise<string> {
  const user = await resolveCurrentUser();
  return user.id;
}
