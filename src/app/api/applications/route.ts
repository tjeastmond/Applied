import { getRepository } from "@/lib/server/db";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
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
  log.info("application created", {
    route: "/api/applications",
    method: "POST",
    id: application.id,
    company: application.company,
  });
  return NextResponse.json(application, { status: 201 });
}
