import { buildSessionSetCookieHeader, SESSION_MAX_AGE_SECONDS, signSessionCookie } from "@/lib/appAccessAuth";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { isAccessTokenValid } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { z } from "zod";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const loginSchema = z.strictObject({
  accessToken: z.string().min(1),
});

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, loginSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  if (!isAccessTokenValid(parsed.data.accessToken)) {
    log.warn("app auth rejected", { route: "/api/auth/login", method: "POST" });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const sessionValue = await signSessionCookie(parsed.data.accessToken, expiresAt);

  log.info("app session created", { route: "/api/auth/login", method: "POST" });

  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": buildSessionSetCookieHeader(sessionValue) } });
}
