import {
  buildSessionSetCookieHeader,
  SESSION_MAX_AGE_SECONDS,
  signSessionCookie,
  verifySessionCookie,
} from "@/lib/appAccessAuth";
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

/** Fresh DB read; refreshes the cache unless a clear raced the read (then the value is used once, not cached). */
async function readHash(): Promise<string | null> {
  const repo = getUserRepository();
  const startedAt = generation;
  // No ensureDefaultUser: a missing row just means no password yet, so the token-only secret applies.
  const hash = (await repo.getCredentialById(DEFAULT_USER_ID))?.passwordHash ?? null;
  if (startedAt === generation) cached = { repo, hash, expires: Date.now() + HASH_TTL_MS };
  return hash;
}

const withHash = (accessToken: string, hash: string | null) => (hash ? `${accessToken}:${hash}` : accessToken);

function cachedHash(): { hash: string | null } | null {
  return cached?.repo === getUserRepository() && cached.expires >= Date.now() ? cached : null;
}

/** Signing secret bound to the owner's password hash so a password change invalidates old sessions. Cached: verify path only. */
// shortcut: session secret is bound to the password hash, so sessions signed before this shipped were rejected once and any password change/setup logs out all sessions; accept the token-only secret as a fallback only if one-time logouts become a problem (it would let pre-change sessions survive).
export async function getSessionSecret(accessToken: string): Promise<string> {
  return withHash(accessToken, (cachedHash() ?? { hash: await readHash() }).hash);
}

/** Verify a session cookie; a failure on a cached secret retries once with a fresh read (another instance may have changed the password). */
export async function verifySessionWithFreshRetry(accessToken: string, cookie: string): Promise<boolean> {
  const hit = cachedHash();
  const secret = withHash(accessToken, hit ? hit.hash : await readHash());
  if (await verifySessionCookie(secret, cookie)) return true;
  if (!hit) return false;
  // Cost: a garbage cookie forces one DB read per request, same as before the cache.
  const fresh = withHash(accessToken, await readHash());
  return fresh !== secret && verifySessionCookie(fresh, cookie);
}

/** Signing always reads fresh: another instance may have changed the password, and a cookie signed with a stale hash would not verify. */
export async function buildSessionCookieHeader(accessToken: string): Promise<string> {
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return buildSessionSetCookieHeader(await signSessionCookie(withHash(accessToken, await readHash()), expiresAt));
}
