import { z } from "zod";

export const agentCreateApplicationSchema = z.object({
  url: z.string().trim().min(1, "url is required").max(2048),
});

export type AgentCreateApplicationInput = z.infer<typeof agentCreateApplicationSchema>;
