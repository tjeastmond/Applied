import { parseJobUrl } from "@/lib/server/services/parseJobUrl";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { parseJobUrlRequestSchema } from "@/lib/schemas/parseJob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, parseJobUrlRequestSchema);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const result = await parseJobUrl(parsed.data.url);
  return NextResponse.json(result);
}
