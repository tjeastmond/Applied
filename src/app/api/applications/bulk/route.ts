import { getRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { bulkFetchApplicationsSchema } from "@/lib/schemas/application";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const POST = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, bulkFetchApplicationsSchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  const repository = getRepository();
  if (data.ids?.length === 0) {
    return NextResponse.json({ applications: [] });
  }

  const applications = data.ids && data.ids.length > 0 ? await repository.listByIds(data.ids) : await repository.list();

  return NextResponse.json({ applications });
});
