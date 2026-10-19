import { withAppAccess } from "@/lib/server/appAuth";
import { getRepository } from "@/lib/server/db";
import { log } from "@/lib/server/logging/logger";
import { archiveStaleApplications } from "@/lib/server/services/staleApplicationService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = withAppAccess(async () => {
  const { affected } = await archiveStaleApplications();
  const archivedCount = affected.length;

  if (archivedCount > 0) {
    log.info("stale applications archived", {
      route: "/api/applications/archive-stale",
      method: "POST",
      archivedCount,
    });
  }

  return NextResponse.json({ archivedCount, applications: await getRepository().list() });
});
