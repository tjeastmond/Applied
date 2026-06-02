import { parseJobUrl } from "@/lib/server/services/parseJobUrl";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await readJson<{ url?: string }>(request);
  if (!body?.url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }
  const result = await parseJobUrl(body.url);
  return NextResponse.json(result);
}
