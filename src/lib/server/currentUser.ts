import { getUserRepository } from "@/lib/server/db";

/** Resolve the acting user for writes until per-user sessions exist. */
export async function resolveCurrentUserId(): Promise<string> {
  const user = await getUserRepository().ensureDefaultUser();
  return user.id;
}
