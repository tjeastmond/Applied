import { badRequestResponse, jsonError } from "@/lib/server/applicationRouteHelpers";
import { getUserRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { updateUserProfileSchema } from "@/lib/schemas/user";
import { resolveCurrentUserId } from "@/lib/server/currentUser";
import type { UserProfile } from "@/types";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userRepositoryForProfileWrite() {
  return getUserRepository();
}

export const GET = withAppAccess(async () => {
  const users = getUserRepository();
  const [user, hasPasswordLogin] = await Promise.all([users.ensureDefaultUser(), users.hasPasswordLogin()]);
  const profile: UserProfile = { ...user, hasPasswordLogin };
  return NextResponse.json(profile);
});

export const PATCH = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, updateUserProfileSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const userId = await resolveCurrentUserId();
  const users = userRepositoryForProfileWrite();
  const hasPassword = await users.hasPasswordLogin();

  if (hasPassword && !data.email) {
    return badRequestResponse("Email is required");
  }

  if (data.email && (await users.isEmailTaken(data.email, userId))) {
    return jsonError("Email is already in use", 409);
  }

  const user = await users.updateProfile(userId, data);
  if (!user) {
    return jsonError("User not found", 404);
  }

  log.info("user profile updated", {
    route: "/api/user/profile",
    method: "PATCH",
    userId: user.id,
  });

  return NextResponse.json(user);
});
