import type { ParsedCreateJobApplicationInput, PatchJobApplicationInput } from "@/lib/schemas/application";
import { sanitizeStoredHtml } from "@/lib/server/services/extractFullJd";

export function sanitizeApplicationInput<T extends ParsedCreateJobApplicationInput | PatchJobApplicationInput>(
  input: T,
): T {
  if (!("fullJd" in input) || input.fullJd == null) {
    return input;
  }

  return {
    ...input,
    fullJd: sanitizeStoredHtml(input.fullJd),
  };
}
