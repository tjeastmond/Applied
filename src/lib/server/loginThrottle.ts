import { getLoginThrottleRepository } from "@/lib/server/db";
import { jsonError } from "@/lib/server/applicationRouteHelpers";
import type { LoginThrottleRecord, LoginThrottleRepository } from "@/lib/server/repositories/loginThrottleRepository";

/**
 * Failed sign-in limits, stored in the database so they hold across serverless instances.
 * Per-client limits stop one source from guessing; the looser global limit caps distributed guessing
 * without letting a single noisy client lock the owner out for long.
 */
export const LOGIN_THROTTLE_LIMITS = {
  client: { maxFailures: 10, windowMs: 15 * 60 * 1000 },
  global: { maxFailures: 100, windowMs: 60 * 60 * 1000 },
} as const;

const GLOBAL_KEY = "global";

type ThrottleScope = keyof typeof LOGIN_THROTTLE_LIMITS;

/** Fallback for backends without a throttle table (test doubles). */
class InMemoryLoginThrottleRepository implements LoginThrottleRepository {
  private readonly records = new Map<string, LoginThrottleRecord>();

  get(key: string) {
    return this.records.get(key) ?? null;
  }

  recordFailure(key: string, now: number, windowCutoff: number) {
    const existing = this.records.get(key);
    if (!existing || existing.windowStartedAt <= windowCutoff) {
      this.records.set(key, { failures: 1, windowStartedAt: now });
      return;
    }
    existing.failures += 1;
  }

  clear(key: string) {
    this.records.delete(key);
  }

  pruneExpired(windowCutoff: number) {
    for (const [key, record] of this.records) {
      if (record.windowStartedAt <= windowCutoff) {
        this.records.delete(key);
      }
    }
  }
}

const inMemoryFallback = new InMemoryLoginThrottleRepository();

function throttleRepository(): LoginThrottleRepository {
  return getLoginThrottleRepository() ?? inMemoryFallback;
}

/** Vercel sets x-forwarded-for to the real client address; locally every request shares one bucket. */
export function loginClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
  return `ip:${ip.slice(0, 64)}`;
}

function keysFor(request: Request): [ThrottleScope, string][] {
  return [
    ["client", loginClientKey(request)],
    ["global", GLOBAL_KEY],
  ];
}

function retryAfterSeconds(record: LoginThrottleRecord | null, scope: ThrottleScope, now: number): number | null {
  const { maxFailures, windowMs } = LOGIN_THROTTLE_LIMITS[scope];
  if (!record || record.failures < maxFailures) {
    return null;
  }
  const remainingMs = record.windowStartedAt + windowMs - now;
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : null;
}

/** Returns a 429 response when the client or the deployment has too many recent failures. */
export async function checkLoginThrottle(request: Request, now = Date.now()): Promise<Response | null> {
  const repository = throttleRepository();
  let retryAfter: number | null = null;

  for (const [scope, key] of keysFor(request)) {
    const seconds = retryAfterSeconds(await repository.get(key), scope, now);
    if (seconds !== null) {
      retryAfter = Math.max(retryAfter ?? 0, seconds);
    }
  }

  if (retryAfter === null) {
    return null;
  }

  const response = jsonError("Too many sign-in attempts. Try again later.", 429);
  response.headers.set("Retry-After", String(retryAfter));
  return response;
}

export async function recordLoginFailure(request: Request, now = Date.now()): Promise<void> {
  const repository = throttleRepository();
  for (const [scope, key] of keysFor(request)) {
    await repository.recordFailure(key, now, now - LOGIN_THROTTLE_LIMITS[scope].windowMs);
  }
  await repository.pruneExpired(now - LOGIN_THROTTLE_LIMITS.global.windowMs);
}

/** A successful sign-in resets that client's counter; the global window still expires on its own. */
export async function clearLoginFailures(request: Request): Promise<void> {
  await throttleRepository().clear(loginClientKey(request));
}
