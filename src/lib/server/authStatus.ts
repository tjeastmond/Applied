import { getAppAccessToken, isAppAccessAuthorized } from "@/lib/appAccessAuth";
import type { AuthStatus } from "@/lib/authTypes";
import { ensureAppAccessTokenHydrated } from "@/lib/server/appAccessToken";
import { getUserRepository } from "@/lib/server/db";
import { isDevQuickLoginAvailable } from "@/lib/server/devAuth";

export type { AuthStatus } from "@/lib/authTypes";

export async function getAuthStatus(request: Request): Promise<AuthStatus> {
  ensureAppAccessTokenHydrated();
  const appAccessConfigured = Boolean(getAppAccessToken());
  const authenticated = appAccessConfigured && (await isAppAccessAuthorized(request));
  const devQuickLoginAvailable = isDevQuickLoginAvailable();
  const hasPasswordLogin = await getUserRepository().hasPasswordLogin();

  return {
    authenticated,
    appAccessConfigured,
    devQuickLoginAvailable,
    setupRequired: !hasPasswordLogin,
  };
}

export function requestFromCookieHeader(cookieHeader: string | undefined): Request {
  return new Request("http://localhost/", {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });
}
