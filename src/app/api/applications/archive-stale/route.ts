import { withAppAccess } from "@/lib/server/appAuth";
import { omitFullJd } from "@/lib/server/listApplication";
import { getRepository } from "@/lib/server/db";
import { conflictResponseOrThrow } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { archiveStaleApplications } from "@/lib/server/services/staleApplicationService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = withAppAccess(async () => {
  const result = await archiveStaleApplications().catch(conflictResponseOrThrow);
  if (result instanceof Response) {
    return result;
  }
  const { affected } = result;
  const archivedCount = affected.length;

  if (archivedCount > 0) {
    log.info("stale applications archived", {
      route: "/api/applications/archive-stale",
      method: "POST",
      archivedCount,
    });
  }

  return NextResponse.json({ archivedCount, applications: (await getRepository().listSummaries()).map(omitFullJd) });
});
