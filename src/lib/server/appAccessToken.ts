import { getAppAccessToken } from "@/lib/appAccessAuth";
import { getAppAccessConfigRepository } from "@/lib/server/db";

export function syncAppAccessTokenToEnv(token: string): void {
  process.env.APP_ACCESS_TOKEN = token;
}

export function hydrateAppAccessTokenFromDatabase(token: string | null): void {
  if (process.env.APP_ACCESS_TOKEN?.trim()) {
    return;
  }

  if (token) {
    syncAppAccessTokenToEnv(token);
  }
}

/** Load a DB-stored dev token into process.env before auth checks on Node routes. */
export function ensureAppAccessTokenHydrated(): void {
  if (getAppAccessToken()) {
    return;
  }

  const repository = getAppAccessConfigRepository();
  if (!repository) {
    return;
  }

  hydrateAppAccessTokenFromDatabase(repository.getToken());
}
