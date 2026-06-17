import { parseJobUrl } from "@/lib/server/services/parseJobUrl";
import { requireAppAccess } from "@/lib/server/appAuth";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { log } from "@/lib/server/logging/logger";
import { hostFromUrl } from "@/lib/server/logging/sanitize";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { parseJobUrlRequestSchema, parseJobUrlResultSchema } from "@/lib/schemas/parseJob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const authError = await requireAppAccess(request);
  if (authError) {
    return authError;
  }

  const parsed = await parseRequestBody(request, parseJobUrlRequestSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const url = parsed.data.url;
  const result = parseJobUrlResultSchema.parse(await parseJobUrl(url));
  const host = hostFromUrl(url);

  if (result.ok) {
    log.info("job url parsed", {
      route: "/api/jobs/parse",
      method: "POST",
      host,
      hasTitle: Boolean(result.title),
      hasSalary: Boolean(result.salaryRange),
    });
  }

  return NextResponse.json(result);
}
