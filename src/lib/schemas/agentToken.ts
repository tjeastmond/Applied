import { z } from "zod";

export const createAgentApiTokenSchema = z.strictObject({
  name: z.string().trim().min(1, "name is required").max(64, "name must be 64 characters or fewer"),
});
