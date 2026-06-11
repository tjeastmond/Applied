import { importModeSchema } from "@/lib/schemas/backup";
import { getDatabaseBackend, resetDatabaseBackend } from "@/lib/server/db";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

function detectFormat(filename: string, content: string): "sql" | "json" | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".json")) return "json";

  const trimmed = content.trim();
  if (trimmed.startsWith("{")) return "json";
  if (trimmed.startsWith("--") || /^PRAGMA\b/i.test(trimmed) || /^BEGIN\b/i.test(trimmed)) return "sql";
  return null;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  const modeRaw = formData.get("mode");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const modeParsed = importModeSchema.safeParse(modeRaw);
  if (!modeParsed.success) {
    return NextResponse.json({ error: "mode must be replace or upsert" }, { status: 400 });
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "Backup file is empty" }, { status: 400 });
  }

  if (file.size > MAX_BACKUP_BYTES) {
    return NextResponse.json({ error: "Backup file is too large" }, { status: 413 });
  }

  const content = await file.text();
  const format = detectFormat(file.name, content);
  if (!format) {
    return NextResponse.json({ error: "Could not detect backup format (.sql or .json)" }, { status: 400 });
  }

  try {
    const backend = getDatabaseBackend();
    const result =
      format === "json"
        ? await backend.importJson(JSON.parse(content) as unknown, modeParsed.data)
        : await backend.importSql(content, modeParsed.data);

    if (format === "sql" && modeParsed.data === "replace") {
      resetDatabaseBackend();
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    if (message.includes("JSON") || message.includes("Unexpected token")) {
      return NextResponse.json({ error: "Invalid backup JSON format" }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
