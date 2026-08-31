import { getCompanyRepository } from "@/lib/server/db";
import { withAppAccess } from "@/lib/server/appAuth";
import { log } from "@/lib/server/logging/logger";
import { parseRequestBody, parsedBodyOrResponse } from "@/lib/server/parseRequestBody";
import { companyConflictResponse } from "@/lib/server/companyRouteHelpers";
import { createCompanySchema, companyListQuerySchema } from "@/lib/schemas/company";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export const GET = withAppAccess(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const parsedQuery = companyListQuerySchema.safeParse({
    search: searchParams.get("search") ?? undefined,
    ignored: searchParams.get("ignored") ?? undefined,
  });
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 });
  }

  const companies = await getCompanyRepository().list(parsedQuery.data);
  return NextResponse.json(companies);
});

export const POST = withAppAccess(async (request: Request) => {
  const parsed = await parseRequestBody(request, createCompanySchema);
  const data = parsedBodyOrResponse(parsed);
  if (data instanceof Response) {
    return data;
  }

  try {
    const company = await getCompanyRepository().create(data);
    log.info("company created", {
      route: "/api/companies",
      method: "POST",
      id: company.id,
      name: company.name,
    });
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Company name already exists") {
      return companyConflictResponse();
    }
    throw error;
  }
});
