import { z } from "zod";

const agentApiTokenNameSchema = z
  .string()
  .trim()
  .min(1, "name is required")
  .max(64, "name must be 64 characters or fewer");

export const createAgentApiTokenSchema = z.strictObject({
  name: agentApiTokenNameSchema,
});

export const importAgentTokenFromEnvSchema = z.strictObject({
  name: agentApiTokenNameSchema,
});

export const renameAgentApiTokenSchema = z.strictObject({
  name: agentApiTokenNameSchema,
});
