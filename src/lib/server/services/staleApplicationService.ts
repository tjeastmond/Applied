import { getRepository } from "@/lib/server/db";
import { patchApplicationWithSideEffects } from "@/lib/server/services/applicationMutationService";
import { isStaleApplication } from "@/lib/staleApplications";
import type { JobApplication } from "@/types";

export type ArchiveStaleResult = {
  /** Applications that were (or, for a dry run, would be) marked no_response and archived. */
  affected: JobApplication[];
};

/** Marks stale applications `no_response` and archives them via the shared status-change path. */
export async function archiveStaleApplications(
  options: { dryRun?: boolean; onArchived?: (application: JobApplication) => Promise<void> } = {},
): Promise<ArchiveStaleResult> {
  const now = new Date();
  const stale = (await getRepository().list()).filter((application) => isStaleApplication(application, now));

  if (options.dryRun) {
    return { affected: stale };
  }

  const affected: JobApplication[] = [];
  for (const application of stale) {
    const updated = await patchApplicationWithSideEffects(
      application.id,
      { status: "no_response", archived: true },
      application,
    );
    if (updated) {
      affected.push(updated);
      await options.onArchived?.(updated);
    }
  }
  return { affected };
}
