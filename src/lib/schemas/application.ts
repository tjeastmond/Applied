import { z } from "zod";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";
import { emptyToNull, sanitizeOptionalPlainText } from "@/lib/sanitize";
import {
  applicationStatusSchema,
  isoDateSchema,
  optionalEmailSchema,
  optionalFullJdSchema,
  optionalHttpUrlSchema,
  optionalPhoneSchema,
  optionalPlainTextSchema,
  requiredHttpUrlSchema,
  requiredPlainTextSchema,
  uuidSchema,
} from "@/lib/schemas/common";

const SALARY_FIELD_MAX_LENGTH = 100;

const titleSchema = requiredPlainTextSchema("title", 200).transform((value) => normalizeJobTitle(value) ?? value);

type RecruiterRefineValue = {
  viaRecruiter?: boolean;
  recruiterName?: string | null;
  recruiterFirm?: string | null;
};

function addRecruiterFieldsWhenNotViaRecruiterIssues(
  value: RecruiterRefineValue,
  ctx: z.RefinementCtx,
  mode: "create" | "patch",
) {
  if (mode === "create") {
    if (value.viaRecruiter) return;
    if (value.recruiterName) {
      ctx.addIssue({
        code: "custom",
        path: ["recruiterName"],
        message: "recruiterName must be null when viaRecruiter is false",
      });
    }
    if (value.recruiterFirm) {
      ctx.addIssue({
        code: "custom",
        path: ["recruiterFirm"],
        message: "recruiterFirm must be null when viaRecruiter is false",
      });
    }
    return;
  }

  if (value.viaRecruiter !== false) return;
  if (value.recruiterName !== undefined && value.recruiterName !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["recruiterName"],
      message: "recruiterName must be null when viaRecruiter is false",
    });
  }
  if (value.recruiterFirm !== undefined && value.recruiterFirm !== null) {
    ctx.addIssue({
      code: "custom",
      path: ["recruiterFirm"],
      message: "recruiterFirm must be null when viaRecruiter is false",
    });
  }
}

export const requiredApplicationFieldsSchema = z.strictObject({
  url: requiredHttpUrlSchema,
  title: titleSchema,
  company: requiredPlainTextSchema("company", 200),
  appliedAt: isoDateSchema,
});

export const applicationSalaryFieldSchemas = {
  salaryRange: optionalPlainTextSchema(SALARY_FIELD_MAX_LENGTH),
  desiredSalary: optionalPlainTextSchema(SALARY_FIELD_MAX_LENGTH),
} as const;

export const applicationSalaryFieldsSchema = z.strictObject(applicationSalaryFieldSchemas);

/** Parsed job URL salary values may be truncated before persistence. */
export const parsedSalaryRangeSchema = z.preprocess((value) => {
  const normalized = emptyToNull(value);
  return typeof normalized === "string" ? sanitizeOptionalPlainText(normalized, SALARY_FIELD_MAX_LENGTH) : normalized;
}, applicationSalaryFieldSchemas.salaryRange);

export const parsedApplicationSalaryFieldsSchema = z
  .strictObject({
    salaryRange: parsedSalaryRangeSchema.optional(),
  })
  .transform((value) => ({ salaryRange: value.salaryRange ?? null }));

export function parseParsedApplicationSalaryFields(
  fields: z.input<typeof parsedApplicationSalaryFieldsSchema>,
): z.infer<typeof parsedApplicationSalaryFieldsSchema> {
  return parsedApplicationSalaryFieldsSchema.parse(fields);
}

const optionalApplicationFieldsSchema = {
  linkedinUrl: optionalHttpUrlSchema,
  viaRecruiter: z.boolean().optional(),
  recruiterName: optionalPlainTextSchema(200),
  recruiterFirm: optionalPlainTextSchema(200),
  contactEmail: optionalEmailSchema,
  contactPhone: optionalPhoneSchema,
  ...applicationSalaryFieldSchemas,
  fullJd: optionalFullJdSchema,
  status: applicationStatusSchema.optional(),
  archived: z.boolean().optional(),
} as const;

const jobApplicationSchema = requiredApplicationFieldsSchema.extend(optionalApplicationFieldsSchema);

export const createJobApplicationSchema = jobApplicationSchema.superRefine((value, ctx) => {
  addRecruiterFieldsWhenNotViaRecruiterIssues(value, ctx, "create");
});

export const patchJobApplicationSchema = jobApplicationSchema.partial().superRefine((value, ctx) => {
  addRecruiterFieldsWhenNotViaRecruiterIssues(value, ctx, "patch");
});

export const bulkFetchApplicationsSchema = z.object({
  ids: z.array(uuidSchema).optional(),
});

export const bulkArchiveApplicationsSchema = z.object({
  statuses: z.array(applicationStatusSchema).optional(),
});

export type BulkFetchApplicationsInput = z.infer<typeof bulkFetchApplicationsSchema>;
export type BulkArchiveApplicationsInput = z.infer<typeof bulkArchiveApplicationsSchema>;

export type ApplicationSalaryInput = z.input<typeof applicationSalaryFieldsSchema>;
export type ParsedApplicationSalaryInput = z.infer<typeof applicationSalaryFieldsSchema>;
export type ParsedApplicationSalaryFields = z.infer<typeof parsedApplicationSalaryFieldsSchema>;

export type CreateJobApplicationInput = z.input<typeof createJobApplicationSchema>;
export type ParsedCreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;
export type PatchJobApplicationInput = z.infer<typeof patchJobApplicationSchema>;
