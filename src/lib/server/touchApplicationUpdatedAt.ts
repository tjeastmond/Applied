import { getRepository } from "@/lib/server/db";

export async function touchApplicationUpdatedAt(applicationId: string): Promise<string | null> {
  const updated = await getRepository().update(applicationId, {});
  return updated?.updatedAt ?? null;
}
