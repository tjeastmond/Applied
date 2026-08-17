import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { getUserRepository } from "@/lib/server/db";
import { issueAppSessionResponse } from "@/lib/server/issueAppSession";
import { log } from "@/lib/server/logging/logger";
import { runDummyPasswordVerify, verifyPassword } from "@/lib/server/passwordHash";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { passwordLoginSchema } from "@/lib/schemas/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UNAUTHORIZED_BODY = { error: "Unauthorized" } as const;

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, passwordLoginSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const { email, password } = parsed.data;
  const users = getUserRepository();
  const credential = await users.getCredentialByEmail(email);

  if (!credential) {
    await runDummyPasswordVerify(password);
    log.warn("app login failed", { route: "/api/auth/password-login", method: "POST", reason: "invalid credentials" });
    return NextResponse.json(UNAUTHORIZED_BODY, { status: 401 });
  }

  const valid = await verifyPassword(password, credential.passwordHash);
  if (!valid) {
    log.warn("app login failed", { route: "/api/auth/password-login", method: "POST", reason: "invalid credentials" });
    return NextResponse.json(UNAUTHORIZED_BODY, { status: 401 });
  }

  const sessionResponse = await issueAppSessionResponse("password", "/api/auth/password-login");
  if (sessionResponse.status !== 200) {
    return sessionResponse;
  }

  return sessionResponse;
}
