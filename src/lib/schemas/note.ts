import { z } from "zod";
import { requiredPlainTextSchema } from "@/lib/schemas/common";

export const createApplicationNoteSchema = z.strictObject({
  content: requiredPlainTextSchema("content", 10_000),
});

export const updateApplicationNoteSchema = createApplicationNoteSchema;

export type CreateApplicationNoteInput = z.infer<typeof createApplicationNoteSchema>;
export type UpdateApplicationNoteInput = z.infer<typeof updateApplicationNoteSchema>;
