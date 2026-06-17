import { buildSessionClearCookieHeader } from "@/lib/appAccessAuth";
import { requireAppAccess } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    if (authError.status === 401) {
      log.warn("app logout failed", { route: "/api/auth/logout", method: "POST", reason: "unauthorized" });
    }
    return authError;
  }

  log.info("app logout succeeded", { route: "/api/auth/logout", method: "POST" });

  return NextResponse.json({ ok: true }, { headers: { "Set-Cookie": buildSessionClearCookieHeader() } });
}
