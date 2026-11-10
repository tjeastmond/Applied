import { buildSessionSetCookieHeader, SESSION_MAX_AGE_SECONDS, signSessionCookie } from "@/lib/appAccessAuth";
import { getUserRepository } from "@/lib/server/db";

/** Signing secret bound to the owner's password hash so a password change invalidates old sessions. */
export async function getSessionSecret(accessToken: string): Promise<string> {
  const users = getUserRepository();
  const owner = await users.ensureDefaultUser();
  const credential = await users.getCredentialById(owner.id);
  return credential?.passwordHash ? `${accessToken}:${credential.passwordHash}` : accessToken;
}

export async function buildSessionCookieHeader(accessToken: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return buildSessionSetCookieHeader(await signSessionCookie(await getSessionSecret(accessToken), expiresAt));
}
