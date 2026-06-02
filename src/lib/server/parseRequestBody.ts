import type { ZodType } from "zod";
import { formatZodError } from "@/lib/formatZodError";

export { formatZodError };

export async function parseRequestBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { ok: false, error: "Invalid JSON body" };
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    return { ok: false, error: formatZodError(result.error) };
  }

  return { ok: true, data: result.data };
}
