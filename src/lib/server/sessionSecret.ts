import { buildSessionSetCookieHeader, SESSION_MAX_AGE_SECONDS, signSessionCookie } from "@/lib/appAccessAuth";
import { getUserRepository } from "@/lib/server/db";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";

const HASH_TTL_MS = 30_000;
// shortcut: per-process cache, so other instances (Vercel) may accept an old session for up to the TTL after a password change; drop the TTL or use a shared store if that matters.
let cached: { repo: object; hash: string | null; expires: number } | null = null;

let generation = 0;

/** Call whenever the owner's password hash can change (password change, setup, backup import). */
export function clearSessionSecretCache(): void {
  cached = null;
  generation++;
}

/** Signing secret bound to the owner's password hash so a password change invalidates old sessions. */
export async function getSessionSecret(accessToken: string): Promise<string> {
  const repo = getUserRepository();
  let hash: string | null;
  if (cached?.repo === repo && cached.expires >= Date.now()) {
    hash = cached.hash;
  } else {
    const startedAt = generation;
    // No ensureDefaultUser: a missing row just means no password yet, so the token-only secret applies.
    const credential = await repo.getCredentialById(DEFAULT_USER_ID);
    hash = credential?.passwordHash ?? null;
    // A clear during the read means this value may be stale: use it once, don't cache it.
    if (startedAt === generation) cached = { repo, hash, expires: Date.now() + HASH_TTL_MS };
  }
  return hash ? `${accessToken}:${hash}` : accessToken;
}

export async function buildSessionCookieHeader(accessToken: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return buildSessionSetCookieHeader(await signSessionCookie(await getSessionSecret(accessToken), expiresAt));
}
