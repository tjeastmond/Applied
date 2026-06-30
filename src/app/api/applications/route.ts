import { getRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { sanitizeApplicationInput } from "@/lib/server/sanitizeApplicationInput";
import { createJobApplicationSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAppAccess(async () => {
  const applications = await getRepository().list();
  return NextResponse.json(applications);
});

export const POST = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, createJobApplicationSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const application = await getRepository().create(sanitizeApplicationInput(data));
  log.info("application created", {
    route: "/api/applications",
    method: "POST",
    id: application.id,
    company: application.company,
  });
  return NextResponse.json(application, { status: 201 });
});
