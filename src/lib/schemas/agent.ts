import type { JobApplication } from "@/types";
import { z } from "zod";

export type AgentApplicationSummary = Pick<
  JobApplication,
  "id" | "url" | "status" | "title" | "company" | "appliedAt" | "updatedAt"
>;

export const agentListApplicationsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
});

export const agentCreateApplicationSchema = z.object({
  url: z.string().trim().min(1, "url is required").max(2048),
});

export type AgentListApplicationsQuery = z.infer<typeof agentListApplicationsQuerySchema>;
export type AgentCreateApplicationInput = z.infer<typeof agentCreateApplicationSchema>;
