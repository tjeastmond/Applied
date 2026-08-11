import { z } from "zod";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";
import { parsedSalaryRangeSchema } from "@/lib/schemas/application";
import { requiredHttpUrlSchema } from "@/lib/schemas/common";

export const parseJobUrlRequestSchema = z.strictObject({
  url: requiredHttpUrlSchema,
});

const parsedJobTitleSchema = z.union([z.string(), z.null()]).transform((value) => normalizeJobTitle(value));

export const parseJobUrlSuccessSchema = z.strictObject({
  ok: z.literal(true),
  title: parsedJobTitleSchema,
  company: z.string().nullable(),
  salaryRange: parsedSalaryRangeSchema.optional().default(null),
  fullJd: z.string().nullable(),
});

export const parseJobUrlFailureSchema = z.strictObject({
  ok: z.literal(false),
  error: z.string(),
});

export const parseJobUrlResultSchema = z.discriminatedUnion("ok", [parseJobUrlSuccessSchema, parseJobUrlFailureSchema]);

export type ParseJobUrlRequest = z.infer<typeof parseJobUrlRequestSchema>;
export type ParseJobUrlSuccess = z.infer<typeof parseJobUrlSuccessSchema>;
export type ParseJobUrlFailure = z.infer<typeof parseJobUrlFailureSchema>;
export type ParseJobUrlResult = z.infer<typeof parseJobUrlResultSchema>;
