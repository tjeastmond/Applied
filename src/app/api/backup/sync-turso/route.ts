import { importModeSchema } from "@/lib/schemas/backup";
import { logAndRespondFromUnknown } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { isTursoSyncAvailable, pushSqliteToTurso } from "@/lib/server/services/databaseTransferService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function logTursoVerification(result: Awaited<ReturnType<typeof pushSqliteToTurso>>, mode: string): void {
  log.info("turso sync completed", {
    route: "/api/backup/sync-turso",
    method: "POST",
    mode,
    matches: result.verification.matches,
    importedApplications: result.imported.applications,
    importedNotes: result.imported.notes,
  });

  if (!result.verification.matches) {
    log.warn("turso verify mismatch", {
      route: "/api/backup/sync-turso",
      method: "POST",
      differences: result.verification.differences,
    });
  }
}

export async function POST(request: Request) {
  if (!isTursoSyncAvailable()) {
    return NextResponse.json(
      { error: "Turso sync is only available in local development with SQLite and Turso credentials configured" },
      { status: 403 },
    );
  }

  let modeRaw: unknown = "upsert";
  try {
    const body = (await request.json()) as { mode?: unknown };
    modeRaw = body.mode ?? "upsert";
  } catch {
    // Empty body defaults to upsert.
  }

  const modeParsed = importModeSchema.safeParse(modeRaw);
  if (!modeParsed.success) {
    return NextResponse.json({ error: "mode must be replace or upsert" }, { status: 400 });
  }

  try {
    const result = await pushSqliteToTurso({ mode: modeParsed.data });
    logTursoVerification(result, modeParsed.data);
    return NextResponse.json({
      imported: result.imported,
      matches: result.verification.matches,
      differences: result.verification.differences,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Turso sync failed";
    return logAndRespondFromUnknown(error, message, 400, {
      route: "/api/backup/sync-turso",
      method: "POST",
    });
  }
}
