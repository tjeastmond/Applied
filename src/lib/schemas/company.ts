import { z } from "zod";
import { optionalEmailSchema, optionalHttpUrlSchema, requiredPlainTextSchema } from "@/lib/schemas/common";
import { sanitizeHttpUrl, sanitizePlainText } from "@/lib/sanitize";

export const COMPANY_NAME_MAX_LENGTH = 200;

const companyContactFieldsSchema = {
  url: optionalHttpUrlSchema,
  linkedinUrl: optionalHttpUrlSchema,
  email: optionalEmailSchema,
} as const;

const patchHttpUrlSchema = z
  .string()
  .trim()
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

const patchOptionalHttpUrlSchema = z
  .union([patchHttpUrlSchema, z.literal("").transform(() => null), z.null()])
  .optional();

const patchOptionalEmailSchema = z
  .union([
    z
      .string()
      .trim()
      .email("must be a valid email address")
      .max(254)
      .transform((value) => sanitizePlainText(value).toLowerCase().slice(0, 254)),
    z.literal("").transform(() => null),
    z.null(),
  ])
  .optional();

export const createCompanySchema = z.strictObject({
  name: requiredPlainTextSchema("Company name", COMPANY_NAME_MAX_LENGTH),
  ...companyContactFieldsSchema,
});

export const patchCompanySchema = z
  .strictObject({
    name: requiredPlainTextSchema("Company name", COMPANY_NAME_MAX_LENGTH).optional(),
    url: patchOptionalHttpUrlSchema,
    linkedinUrl: patchOptionalHttpUrlSchema,
    email: patchOptionalEmailSchema,
  })
  .superRefine((data, ctx) => {
    if (
      data.name === undefined &&
      data.url === undefined &&
      data.linkedinUrl === undefined &&
      data.email === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "At least one field is required",
      });
    }
  });

export const companyListQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  ignored: z
    .enum(["0", "1"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "1")),
});

export type CreateCompanyInput = z.input<typeof createCompanySchema>;
export type ParsedCreateCompanyInput = z.output<typeof createCompanySchema>;
export type PatchCompanyInput = z.input<typeof patchCompanySchema>;
export type ParsedPatchCompanyInput = z.output<typeof patchCompanySchema>;
export type CompanyListQuery = z.output<typeof companyListQuerySchema>;

export function normalizeCompanyName(name: string): string {
  return sanitizePlainText(name).toLowerCase();
}
