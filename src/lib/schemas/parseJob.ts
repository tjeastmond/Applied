import { z } from "zod";
import { requiredHttpUrlSchema } from "@/lib/schemas/common";

export const parseJobUrlRequestSchema = z.strictObject({
  url: requiredHttpUrlSchema,
});

export type ParseJobUrlRequest = z.infer<typeof parseJobUrlRequestSchema>;
