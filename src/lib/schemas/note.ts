import { z } from "zod";
import { requiredPlainTextSchema } from "@/lib/schemas/common";

export const createApplicationNoteSchema = z.strictObject({
  content: requiredPlainTextSchema("content", 10_000),
});

export type CreateApplicationNoteInput = z.infer<typeof createApplicationNoteSchema>;
