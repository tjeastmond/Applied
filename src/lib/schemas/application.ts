import { z } from "zod";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";
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
} from "@/lib/schemas/common";

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

export const createJobApplicationSchema = z
  .strictObject({
    url: requiredHttpUrlSchema,
    title: titleSchema,
    company: requiredPlainTextSchema("company", 200),
    appliedAt: isoDateSchema,
    linkedinUrl: optionalHttpUrlSchema,
    viaRecruiter: z.boolean().optional(),
    recruiterName: optionalPlainTextSchema(200),
    recruiterFirm: optionalPlainTextSchema(200),
    contactEmail: optionalEmailSchema,
    contactPhone: optionalPhoneSchema,
    fullJd: optionalFullJdSchema,
    status: applicationStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    addRecruiterFieldsWhenNotViaRecruiterIssues(value, ctx, "create");
  });

export const patchJobApplicationSchema = z
  .strictObject({
    url: requiredHttpUrlSchema.optional(),
    title: titleSchema.optional(),
    company: requiredPlainTextSchema("company", 200).optional(),
    appliedAt: isoDateSchema.optional(),
    linkedinUrl: optionalHttpUrlSchema,
    viaRecruiter: z.boolean().optional(),
    recruiterName: optionalPlainTextSchema(200),
    recruiterFirm: optionalPlainTextSchema(200),
    contactEmail: optionalEmailSchema,
    contactPhone: optionalPhoneSchema,
    fullJd: optionalFullJdSchema,
    status: applicationStatusSchema.optional(),
  })
  .superRefine((value, ctx) => {
    addRecruiterFieldsWhenNotViaRecruiterIssues(value, ctx, "patch");
  });

export type CreateJobApplicationInput = z.input<typeof createJobApplicationSchema>;
export type ParsedCreateJobApplicationInput = z.infer<typeof createJobApplicationSchema>;
export type PatchJobApplicationInput = z.infer<typeof patchJobApplicationSchema>;
