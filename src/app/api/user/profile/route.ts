import { getUserRepository, resetDatabaseBackend } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { jsonError } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { updateUserProfileSchema } from "@/lib/schemas/user";
import { resolveCurrentUserId } from "@/lib/server/currentUser";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function userRepositoryForProfileWrite() {
  const users = getUserRepository();
  if (typeof users.updateProfile !== "function") {
    resetDatabaseBackend();
    return getUserRepository();
  }
  return users;
}

export const GET = withAppAccess(async () => {
  const user = await getUserRepository().ensureDefaultUser();
  return NextResponse.json(user);
});

export const PATCH = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, updateUserProfileSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const userId = await resolveCurrentUserId();
  const user = await userRepositoryForProfileWrite().updateProfile(userId, data);
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
