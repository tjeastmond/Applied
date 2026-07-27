"use client";

import { useState } from "react";
import { statusLabel, statusTagClassName, type ApplicationStatus } from "@/lib/applicationStatus";
import { formatNoteTimestamp } from "@/lib/applicationForm";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ApplicationStatusHistoryEntry } from "@/types";
import { ChevronDownIcon } from "lucide-react";

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        statusTagClassName(status),
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

export function ApplicationStatusHistorySection({
  history,
  loading,
}: {
  history: ApplicationStatusHistoryEntry[];
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="hover:bg-muted/60 flex w-full items-center justify-between gap-2 rounded-lg border px-4 py-3 text-left text-sm font-semibold tracking-wide uppercase transition-colors">
          Status History
          <ChevronDownIcon className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {loading && history.length === 0 ? (
            <p className="text-muted-foreground text-sm">Loading status history…</p>
          ) : null}
          {!loading && history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No status changes recorded yet.</p>
          ) : null}
          {history.length > 0 ? (
            <ul className="space-y-3">
              {history.map((entry) => (
                <li key={entry.id} className="bg-muted/40 rounded-lg border px-3 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {entry.fromStatus ? (
                      <>
                        <StatusBadge status={entry.fromStatus} />
                        <span className="text-muted-foreground" aria-hidden="true">
                          →
                        </span>
                      </>
                    ) : null}
                    <StatusBadge status={entry.toStatus} />
                  </div>
                  <p className="text-muted-foreground mt-2 text-xs">
                    {formatNoteTimestamp(entry.changedAt)} · {entry.userDisplayName}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
