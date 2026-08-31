import { getCompanyRepository } from "@/lib/server/db";
import { parseUuid } from "@/lib/schemas/common";
import { jsonError } from "@/lib/server/applicationRouteHelpers";

export type CompanyIdRouteContext = { params: Promise<{ id: string }> };

export function companyNotFoundResponse() {
  return jsonError("Company not found", 404);
}

export function companyConflictResponse() {
  return jsonError("Company name already exists", 409);
}

export async function requireCompanyId(rawId: string): Promise<string | null> {
  const id = parseUuid(rawId);
  if (!id) {
    return null;
  }
  const company = await getCompanyRepository().getById(id);
  return company ? id : null;
}

export async function requireCompanyRouteContext(context: CompanyIdRouteContext): Promise<{ id: string } | Response> {
  const { id: rawId } = await context.params;
  const id = await requireCompanyId(rawId);
  if (!id) {
    return companyNotFoundResponse();
  }
  return { id };
}
