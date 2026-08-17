import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { getUserRepository } from "@/lib/server/db";
import { DEFAULT_USER_ID } from "@/lib/server/defaultUser";
import { issueAppSessionResponse } from "@/lib/server/issueAppSession";
import { log } from "@/lib/server/logging/logger";
import { hashPassword } from "@/lib/server/passwordHash";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { setupAccountSchema } from "@/lib/schemas/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, setupAccountSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const users = getUserRepository();
  await users.ensureDefaultUser();

  const { email, password, displayName } = parsed.data;

  if (await users.isEmailTaken(email, DEFAULT_USER_ID)) {
    return NextResponse.json({ error: "Email is already in use" }, { status: 409 });
  }

  const passwordHash = hashPassword(password);
  const updated = await users.setOwnerPassword({
    email,
    passwordHash,
    displayName,
  });

  if (!updated) {
    return NextResponse.json({ error: "Account already exists" }, { status: 409 });
  }

  const sessionResponse = await issueAppSessionResponse("password-setup", "/api/auth/setup");
  if (sessionResponse.status !== 200) {
    return sessionResponse;
  }

  log.info("owner account created", { route: "/api/auth/setup", method: "POST" });

  return sessionResponse;
}
