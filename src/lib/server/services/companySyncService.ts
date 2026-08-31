import { getCompanyRepository } from "@/lib/server/db";
import type { Company } from "@/types";

export async function ensureCompanyForApplicationName(companyName: string | null | undefined): Promise<Company | null> {
  const trimmed = companyName?.trim();
  if (!trimmed) {
    return null;
  }

  const repository = getCompanyRepository();
  const existing = await repository.findByNormalizedName(trimmed);
  if (existing) {
    return existing;
  }

  try {
    return await repository.create({ name: trimmed });
  } catch (error) {
    if (error instanceof Error && error.message === "Company name already exists") {
      return repository.findByNormalizedName(trimmed);
    }
    throw error;
  }
}
