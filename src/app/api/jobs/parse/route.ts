import { parseJobUrl } from "@/lib/server/services/parseJobUrl";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { parseJobUrlRequestSchema, parseJobUrlResultSchema } from "@/lib/schemas/parseJob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, parseJobUrlRequestSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const result = parseJobUrlResultSchema.parse(await parseJobUrl(parsed.data.url));
  return NextResponse.json(result);
}
