import { badRequestResponse, jsonError } from "@/lib/server/applicationRouteHelpers";
import { getUserRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { resolveCurrentUserId } from "@/lib/server/currentUser";
import { log } from "@/lib/server/logging/logger";
import { hashPassword, verifyPassword } from "@/lib/server/passwordHash";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { changePasswordSchema } from "@/lib/schemas/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UNAUTHORIZED_BODY = { error: "Unauthorized" } as const;

export const POST = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, changePasswordSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const users = getUserRepository();
  if (!(await users.hasPasswordLogin())) {
    return badRequestResponse("Password login is not configured");
  }

  const userId = await resolveCurrentUserId();
  const credential = await users.getCredentialById(userId);
  if (!credential) {
    return badRequestResponse("Password login is not configured");
  }

  const currentValid = await verifyPassword(data.currentPassword, credential.passwordHash);
  if (!currentValid) {
    log.warn("password change rejected", {
      route: "/api/user/password",
      method: "POST",
      reason: "invalid current password",
    });
    return NextResponse.json(UNAUTHORIZED_BODY, { status: 401 });
  }

  const samePassword = await verifyPassword(data.newPassword, credential.passwordHash);
  if (samePassword) {
    return badRequestResponse("New password must differ from current password");
  }

  const passwordHash = hashPassword(data.newPassword);
  const updated = await users.updatePasswordHash(userId, passwordHash);
  if (!updated) {
    return jsonError("User not found", 404);
  }

  log.info("user password changed", {
    route: "/api/user/password",
    method: "POST",
    userId,
  });

  return NextResponse.json({ ok: true as const });
});
