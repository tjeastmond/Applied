import type { ApplicationNote, JobApplication } from "@/types";
import { z } from "zod";
import { createCompanySchema, patchCompanySchema } from "@/lib/schemas/company";
import { applicationStatusSchema } from "@/lib/schemas/common";

export type AgentApplicationSummary = Pick<
  JobApplication,
  "id" | "url" | "status" | "title" | "company" | "appliedAt" | "updatedAt"
>;

export type AgentNoteSummary = Pick<ApplicationNote, "id" | "content" | "createdAt">;

export type AgentCompanySummary = {
  id: string;
  name: string;
  url: string | null;
  linkedinUrl: string | null;
  email: string | null;
  ignored: boolean;
  createdAt: string;
  updatedAt: string;
};

export const agentListApplicationsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  status: applicationStatusSchema.optional(),
});

export const agentListCompaniesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  ignored: z
    .enum(["0", "1"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "1")),
});

export const agentCreateCompanySchema = createCompanySchema;

export const agentPatchCompanySchema = patchCompanySchema;

export const agentSetCompanyIgnoredSchema = z.strictObject({
  ignored: z.boolean(),
});

export const agentCreateApplicationSchema = z.object({
  url: z.string().trim().min(1, "url is required").max(2048),
  status: applicationStatusSchema.optional(),
});

export const agentPatchApplicationSchema = z.strictObject({
  status: applicationStatusSchema,
});

export type AgentListApplicationsQuery = z.infer<typeof agentListApplicationsQuerySchema>;
export type AgentListCompaniesQuery = z.infer<typeof agentListCompaniesQuerySchema>;
export type AgentCreateCompanyInput = z.infer<typeof agentCreateCompanySchema>;
export type AgentPatchCompanyInput = z.infer<typeof agentPatchCompanySchema>;
export type AgentSetCompanyIgnoredInput = z.infer<typeof agentSetCompanyIgnoredSchema>;
export type AgentCreateApplicationInput = z.infer<typeof agentCreateApplicationSchema>;
export type AgentPatchApplicationInput = z.infer<typeof agentPatchApplicationSchema>;
