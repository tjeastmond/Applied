import { getRepository } from "@/lib/server/db";

export async function touchApplicationUpdatedAt(applicationId: string): Promise<string | null> {
  return getRepository().touch(applicationId);
}
