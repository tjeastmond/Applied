import { buildAgentOpenApiDocument } from "@/lib/openapi/generateDocument";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json(buildAgentOpenApiDocument());
}
