import { formatZodError } from "@/lib/formatZodError";
import { analyticsQuerySchema, analyticsResponseSchema } from "@/lib/schemas/analytics";
import { withAppAccess } from "@/lib/server/appAuth";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { buildAnalytics } from "@/lib/server/services/analyticsService";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseArchivedFilter(value: string | null): boolean | null {
  if (value === null || value === "1") return true;
  if (value === "0") return false;
  return null;
}

export const GET = withAppAccess(async (request: Request) => {
  const url = new URL(request.url);
  const includeArchived = parseArchivedFilter(url.searchParams.get("archived"));
  if (includeArchived === null) {
    return badRequestResponse("archived: must be 0 or 1");
  }

  const parsed = analyticsQuerySchema.safeParse({
    range: url.searchParams.get("range") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    companies: url.searchParams.getAll("company"),
    statuses: url.searchParams.getAll("status"),
    includeArchived,
  });
  if (!parsed.success) {
    return badRequestResponse(formatZodError(parsed.error));
  }

  const analytics = analyticsResponseSchema.parse(await buildAnalytics(parsed.data));
  return NextResponse.json(analytics);
});
