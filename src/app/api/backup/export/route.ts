import { backupFormatSchema } from "@/lib/schemas/backup";
import { requireAppAccess } from "@/lib/server/appAuth";
import { getDatabaseBackend } from "@/lib/server/db";
import { logAndRespondFromUnknown } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { backupFilename } from "@/lib/server/services/backupService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const { searchParams } = new URL(request.url);
  const parsed = backupFormatSchema.safeParse(searchParams.get("format"));
  if (!parsed.success) {
    return NextResponse.json({ error: "format must be sql or json" }, { status: 400 });
  }

  try {
    const exportedAt = new Date();
    const backend = getDatabaseBackend();

    if (parsed.data === "json") {
      const payload = await backend.exportJson();
      const body = JSON.stringify(payload, null, 2);
      log.info("backup exported", {
        route: "/api/backup/export",
        method: "GET",
        format: "json",
        applicationCount: payload.applications.length,
        noteCount: payload.notes.length,
      });
      return new NextResponse(body, {
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="${backupFilename("json", exportedAt)}"`,
        },
      });
    }

    const sql = await backend.exportSql();
    log.info("backup exported", {
      route: "/api/backup/export",
      method: "GET",
      format: "sql",
    });
    return new NextResponse(sql, {
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backupFilename("sql", exportedAt)}"`,
      },
    });
  } catch (error) {
    return logAndRespondFromUnknown(error, "Backup export failed", 500, {
      route: "/api/backup/export",
      method: "GET",
    });
  }
}
