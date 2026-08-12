import { z } from "zod";
import { APPLICATION_STATUS_OPTIONS } from "@/lib/applicationStatus";
import { applicationStatusSchema, isoDateSchema } from "./common";

export const ANALYTICS_RANGES = ["30d", "90d", "6m", "12m", "all", "custom"] as const;

export const analyticsRangeSchema = z.enum(ANALYTICS_RANGES);
const analyticsIsoDateSchema = isoDateSchema.refine(
  (value) => new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value,
  "must be a valid date",
);

export const analyticsQuerySchema = z
  .object({
    range: analyticsRangeSchema.default("90d"),
    from: analyticsIsoDateSchema.optional(),
    to: analyticsIsoDateSchema.optional(),
    companies: z.array(z.string().trim().min(1).max(200)).default([]),
    statuses: z.array(applicationStatusSchema).default([]),
    includeArchived: z.boolean().default(true),
  })
  .superRefine((value, context) => {
    if (value.range !== "custom") {
      return;
    }
    if (!value.from) {
      context.addIssue({ code: "custom", path: ["from"], message: "is required for a custom range" });
    }
    if (!value.to) {
      context.addIssue({ code: "custom", path: ["to"], message: "is required for a custom range" });
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({ code: "custom", path: ["from"], message: "must be on or before to" });
    }
  });

const nullableRateSchema = z.number().min(0).max(100).nullable();

export const analyticsResponseSchema = z.object({
  generatedAt: z.iso.datetime(),
  allTimeApplicationCount: z.number().int().nonnegative(),
  cohort: z.object({
    applications: z.number().int().nonnegative(),
    activePipeline: z.number().int().nonnegative(),
    eligible: z.number().int().nonnegative(),
    interviewed: z.number().int().nonnegative(),
    offers: z.number().int().nonnegative(),
  }),
  rates: z.object({
    activePipeline: nullableRateSchema,
    interview: nullableRateSchema,
    offer: nullableRateSchema,
  }),
  volume: z.array(
    z.object({
      bucketStart: isoDateSchema,
      bucketEnd: isoDateSchema,
      label: z.string(),
      count: z.number().int().nonnegative(),
    }),
  ),
  status: z
    .array(
      z.object({
        status: applicationStatusSchema,
        count: z.number().int().nonnegative(),
        percentage: nullableRateSchema,
      }),
    )
    .length(APPLICATION_STATUS_OPTIONS.length),
  companies: z.array(
    z.object({
      company: z.string(),
      applications: z.number().int().nonnegative(),
      interviewed: z.number().int().nonnegative(),
      offers: z.number().int().nonnegative(),
      interviewRate: nullableRateSchema,
      latestAppliedAt: isoDateSchema,
    }),
  ),
  historyIncomplete: z.boolean(),
  sparse: z.boolean(),
});

export type AnalyticsRange = z.infer<typeof analyticsRangeSchema>;
export type AnalyticsFilters = z.infer<typeof analyticsQuerySchema>;
export type AnalyticsResponse = z.infer<typeof analyticsResponseSchema>;
