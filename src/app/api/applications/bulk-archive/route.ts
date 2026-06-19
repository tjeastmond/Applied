import { ARCHIVABLE_STATUSES, isArchivableStatusList } from "@/lib/archivableStatuses";
import { requireAppAccess } from "@/lib/server/appAuth";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { getRepository } from "@/lib/server/db";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { bulkArchiveApplicationsSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const parsed = await parseRequestBody(request, bulkArchiveApplicationsSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const statuses = parsed.data.statuses ?? [...ARCHIVABLE_STATUSES];
  if (!isArchivableStatusList(statuses)) {
    return badRequestResponse("Only rejected and passed statuses can be bulk archived");
  }

  const result = await getRepository().bulkArchiveByStatuses(statuses);

  if (result.archivedCount > 0) {
    log.info("applications bulk archived", {
      route: "/api/applications/bulk-archive",
      method: "POST",
      archivedCount: result.archivedCount,
      statuses,
    });
  }

  return NextResponse.json(result);
}
