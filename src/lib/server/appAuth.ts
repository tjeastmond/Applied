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

export function withAppAccess(
  handler: () => Response | Promise<Response>,
): (request: Request, context: DefaultRouteContext) => Promise<Response>;
export function withAppAccess(
  handler: (request: Request) => Response | Promise<Response>,
): (request: Request, context: DefaultRouteContext) => Promise<Response>;
export function withAppAccess(
  handler: (request: Request, context: DefaultRouteContext) => Response | Promise<Response>,
): (request: Request, context: DefaultRouteContext) => Promise<Response>;
export function withAppAccess<TContext extends DefaultRouteContext>(
  handler: AppAccessHandler<TContext>,
): (request: Request, context: TContext) => Promise<Response>;
export function withAppAccess<TContext extends DefaultRouteContext>(
  handler:
    | (() => Response | Promise<Response>)
    | ((request: Request) => Response | Promise<Response>)
    | AppAccessHandler<TContext>,
): (request: Request, context: TContext | DefaultRouteContext) => Promise<Response> {
  return async (request: Request, context: TContext | DefaultRouteContext) => {
    const authError = await requireAppAccess(request);
    if (authError) {
      return authError;
    }
    if (handler.length === 0) {
      return (handler as () => Response | Promise<Response>)();
    }
    if (handler.length === 1) {
      return (handler as (request: Request) => Response | Promise<Response>)(request);
    }
    return (handler as AppAccessHandler<TContext>)(request, context as TContext);
  };
}

export function isAccessTokenValid(accessToken: string): boolean {
  const configuredToken = getAppAccessToken();
  if (!configuredToken) return false;
  return constantTimeEquals(accessToken, configuredToken);
}

export { bearerTokenFromRequest };
