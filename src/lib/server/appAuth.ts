import { constantTimeEquals, bearerTokenFromRequest } from "@/lib/server/bearerAuth";
import { getAppAccessToken, isAppAccessAuthorized } from "@/lib/appAccessAuth";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

export async function requireAppAccess(request: Request): Promise<Response | null> {
  const configuredToken = getAppAccessToken();
  if (!configuredToken) {
    return jsonError("App access token is not configured", 503);
  }

  if (await isAppAccessAuthorized(request)) {
    return null;
  }

  return jsonError("Unauthorized", 401);
}

export function isAccessTokenValid(accessToken: string): boolean {
  const configuredToken = getAppAccessToken();
  if (!configuredToken) return false;
  return constantTimeEquals(accessToken, configuredToken);
}

export { bearerTokenFromRequest };
