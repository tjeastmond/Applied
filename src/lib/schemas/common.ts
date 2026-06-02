import { z } from "zod";
import { emptyToNull, sanitizeHttpUrl, sanitizeOptionalPlainText, sanitizePlainText } from "@/lib/sanitize";

export const applicationStatusSchema = z.enum(["applied", "interviewing", "rejected", "offer"]);

export const uuidSchema = z.uuid("must be a valid id");

export function parseUuid(raw: string): string | null {
  const result = uuidSchema.safeParse(raw);
  return result.success ? result.data : null;
}

export const isoDateSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00`)), "must be a valid date");

const httpUrlSchema = z
  .string()
  .trim()
  .min(1, "is required")
  .max(2048)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "must be a valid http or https URL")
  .transform(sanitizeHttpUrl);

export const requiredHttpUrlSchema = httpUrlSchema;

export const optionalHttpUrlSchema = z.preprocess(emptyToNull, z.union([httpUrlSchema, z.null()]).optional());

export function requiredPlainTextSchema(label: string, maxLength: number) {
  return z
    .string({ error: `${label} is required` })
    .trim()
    .min(1, `${label} is required`)
    .max(maxLength)
    .transform(sanitizePlainText)
    .refine((value) => value.length > 0, `${label} is required`);
}

export function optionalPlainTextSchema(maxLength: number) {
  return z
    .preprocess(emptyToNull, z.union([z.string().max(maxLength), z.null()]).optional())
    .transform((value) => sanitizeOptionalPlainText(typeof value === "string" ? value : null, maxLength));
}

export const optionalEmailSchema = z
  .preprocess(emptyToNull, z.union([z.email("must be a valid email address").max(254), z.null()]).optional())
  .transform((value) => {
    if (typeof value !== "string") return null;
    const sanitized = sanitizePlainText(value).slice(0, 254);
    return sanitized.length > 0 ? sanitized : null;
  });

export const optionalPhoneSchema = z.preprocess(
  emptyToNull,
  z
    .union([
      z
        .string()
        .max(50)
        .transform(sanitizePlainText)
        .refine((value) => value.length > 0 && /^[\d\s+\-().]+$/.test(value), "must be a valid phone number"),
      z.null(),
    ])
    .optional(),
);

export const optionalFullJdSchema = z.preprocess(emptyToNull, z.union([z.string().max(100_000), z.null()]).optional());
