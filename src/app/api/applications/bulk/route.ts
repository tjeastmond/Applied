import { getRepository } from "@/lib/server/db";
import { badRequestResponse } from "@/lib/server/applicationRouteHelpers";
import { parseRequestBody } from "@/lib/server/parseRequestBody";
import { bulkFetchApplicationsSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const parsed = await parseRequestBody(request, bulkFetchApplicationsSchema);
  if (!parsed.ok) {
    return badRequestResponse(parsed.error);
  }

  const repository = getRepository();
  const applications =
    parsed.data.ids && parsed.data.ids.length > 0
      ? await repository.listByIds(parsed.data.ids)
      : await repository.list();

  return NextResponse.json({ applications });
}
