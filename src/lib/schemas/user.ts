import { z } from "zod";
import { optionalEmailSchema, requiredPlainTextSchema } from "@/lib/schemas/common";

export const updateUserProfileSchema = z.strictObject({
  displayName: requiredPlainTextSchema("Name", 100),
  email: optionalEmailSchema,
});

export type UpdateUserProfileInput = z.infer<typeof updateUserProfileSchema>;
