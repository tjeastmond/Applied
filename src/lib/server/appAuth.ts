import { constantTimeEquals, bearerTokenFromRequest } from "@/lib/server/bearerAuth";
import { getAppAccessToken, isAppAccessAuthorized } from "@/lib/appAccessAuth";
import { ensureAppAccessTokenHydrated } from "@/lib/server/appAccessToken";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

export async function requireAppAccess(request: Request): Promise<Response | null> {
  ensureAppAccessTokenHydrated();
  const configuredToken = getAppAccessToken();
  if (!configuredToken) {
    return jsonError("App access token is not configured", 503);
  }

  if (await isAppAccessAuthorized(request)) {
    return null;
  }

  return jsonError("Unauthorized", 401);
}

export type AppAccessHandler<TContext> = (request: Request, context: TContext) => Response | Promise<Response>;

type DefaultRouteContext = { params: Promise<Record<string, string>> };

export function withAppAccess<TContext = DefaultRouteContext>(
  handler: AppAccessHandler<TContext>,
): (request: Request, context: TContext) => Promise<Response> {
  return async (request, context) => {
    const authError = await requireAppAccess(request);
    return authError ?? handler(request, context);
  };
}

export function isAccessTokenValid(accessToken: string): boolean {
  const configuredToken = getAppAccessToken();
  if (!configuredToken) return false;
  return constantTimeEquals(accessToken, configuredToken);
}

export { bearerTokenFromRequest };
