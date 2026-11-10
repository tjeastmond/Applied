import { buildSessionSetCookieHeader, SESSION_MAX_AGE_SECONDS, signSessionCookie } from "@/lib/appAccessAuth";
import { getUserRepository } from "@/lib/server/db";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";

/** Signing secret bound to the owner's password hash so a password change invalidates old sessions. */
export async function getSessionSecret(accessToken: string): Promise<string> {
  // No ensureDefaultUser: a missing row just means no password yet, so the token-only secret applies.
  const credential = await getUserRepository().getCredentialById(DEFAULT_USER_ID);
  return credential?.passwordHash ? `${accessToken}:${credential.passwordHash}` : accessToken;
}

export async function buildSessionCookieHeader(accessToken: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return buildSessionSetCookieHeader(await signSessionCookie(await getSessionSecret(accessToken), expiresAt));
}
