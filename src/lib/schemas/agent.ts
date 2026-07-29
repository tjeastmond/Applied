import type { ApplicationNote, JobApplication } from "@/types";
import { z } from "zod";
import { applicationStatusSchema } from "@/lib/schemas/common";

export type AgentApplicationSummary = Pick<
  JobApplication,
  "id" | "url" | "status" | "title" | "company" | "appliedAt" | "updatedAt"
>;

export type AgentNoteSummary = Pick<ApplicationNote, "id" | "content" | "createdAt">;

export const agentListApplicationsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const agentListCompaniesQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
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
export type AgentCreateApplicationInput = z.infer<typeof agentCreateApplicationSchema>;
export type AgentPatchApplicationInput = z.infer<typeof agentPatchApplicationSchema>;
