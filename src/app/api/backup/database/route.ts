import { getDatabaseBackend } from "@/lib/server/db";
import { requireAppAccess } from "@/lib/server/appAuth";
import { logAndRespondFromUnknown } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  try {
    const { filename, data } = await getDatabaseBackend().createDatabaseBackup();
    log.info("database backup downloaded", {
      route: "/api/backup/database",
      method: "GET",
      filename,
      byteLength: data.byteLength,
    });

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database backup failed";
    return logAndRespondFromUnknown(error, message, 500, {
      route: "/api/backup/database",
      method: "GET",
    });
  }
}
