import type { Company, CreateCompanyInput, PatchCompanyInput } from "@/types";

export type CompanyListOptions = {
  search?: string;
  ignored?: boolean;
};

export interface CompanyRepository {
  list(options?: CompanyListOptions): Promise<Company[]>;
  getById(id: string): Promise<Company | null>;
  findByNormalizedName(name: string): Promise<Company | null>;
  create(input: CreateCompanyInput): Promise<Company>;
  update(id: string, input: PatchCompanyInput): Promise<Company | null>;
  setIgnored(id: string, ignored: boolean): Promise<Company | null>;
}
