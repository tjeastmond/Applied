import { parseJobUrl } from "@/lib/server/services/parseJobUrl";
import { withAppAccess } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { hostFromUrl } from "@/lib/server/logging/sanitize";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { parseJobUrlRequestSchema, parseJobUrlResultSchema } from "@/lib/schemas/parseJob";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, parseJobUrlRequestSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const url = data.url;
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
});
