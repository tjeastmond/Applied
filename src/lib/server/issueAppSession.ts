import { getAppAccessToken } from "@/lib/appAccessAuth";
import { jsonError } from "@/lib/server/applicationRouteHelpers";
import { syncAppAccessTokenToEnv, ensureAppAccessTokenHydrated } from "@/lib/server/appAccessToken";
import { getAppAccessConfigRepository } from "@/lib/server/db";
import { buildSessionCookieHeader } from "@/lib/server/sessionSecret";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export async function issueAppSessionResponse(
  source: string,
  route: string,
): Promise<NextResponse<{ ok: true }> | NextResponse<{ error: string }>> {
  ensureAppAccessTokenHydrated();

  let accessToken = getAppAccessToken();
  if (!accessToken) {
    const repository = getAppAccessConfigRepository();
    if (repository) {
      accessToken = repository.ensureToken();
      syncAppAccessTokenToEnv(accessToken);
    }
  }

  if (!accessToken) {
    return jsonError("App access token is not configured", 503);
  }

  log.info("app login succeeded", { route, method: "POST", source });

  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": await buildSessionCookieHeader(accessToken) } });
}
