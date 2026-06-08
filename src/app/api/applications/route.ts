import { getRepository } from "@/lib/server/db";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const applications = await getRepository().list();
  return NextResponse.json(applications);
}

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, createJobApplicationSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const application = await getRepository().create(sanitizeApplicationInput(parsed.data));
  return NextResponse.json(application, { status: 201 });
}
