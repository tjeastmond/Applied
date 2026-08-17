import { z } from "zod";
import { requiredEmailSchema, requiredPlainTextSchema } from "@/lib/schemas/common";

export const passwordSchema = z
  .string({ error: "Password is required" })
  .min(10, "Password must be at least 10 characters")
  .max(256, "Password must be at most 256 characters");

export const setupAccountSchema = z.strictObject({
  email: requiredEmailSchema,
  password: passwordSchema,
  displayName: requiredPlainTextSchema("Name", 100),
});

export type SetupAccountInput = z.infer<typeof setupAccountSchema>;

export const passwordLoginSchema = z.strictObject({
  email: requiredEmailSchema,
  password: z.string().min(1, "Password is required").max(256),
});

export type PasswordLoginInput = z.infer<typeof passwordLoginSchema>;

export const changePasswordSchema = z.strictObject({
  currentPassword: z.string().min(1, "Current password is required").max(256),
  newPassword: passwordSchema,
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
