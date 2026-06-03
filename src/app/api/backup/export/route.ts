import { backupFormatSchema } from "@/lib/schemas/backup";
import { getDatabase } from "@/lib/server/db";
import { backupFilename, exportJson, exportSql } from "@/lib/server/services/backupService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = backupFormatSchema.safeParse(searchParams.get("format"));
  if (!parsed.success) {
    return NextResponse.json({ error: "format must be sql or json" }, { status: 400 });
  }

  const exportedAt = new Date();
  const db = getDatabase();

  if (parsed.data === "json") {
    const payload = exportJson(db);
    const body = JSON.stringify(payload, null, 2);
    return new NextResponse(body, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${backupFilename("json", exportedAt)}"`,
      },
    });
  }

  const sql = exportSql(db);
  return new NextResponse(sql, {
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Content-Disposition": `attachment; filename="${backupFilename("sql", exportedAt)}"`,
    },
  });
}
