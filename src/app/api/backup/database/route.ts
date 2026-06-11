import { getDatabaseBackend } from "@/lib/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { filename, data } = await getDatabaseBackend().createDatabaseBackup();

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
