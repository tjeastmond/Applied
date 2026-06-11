import { getDatabase } from "@/lib/server/db";
import { createDatabaseBackup } from "@/lib/server/services/databaseBackupService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const db = getDatabase();
    const { filename, data } = await createDatabaseBackup(db);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Database backup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
