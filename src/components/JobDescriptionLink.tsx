"use client";

import type { MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CopyIcon } from "lucide-react";
import { toast } from "sonner";

type JobDescriptionLinkProps = {
  url: string;
  className?: string;
  /** When true, clicks do not bubble (e.g. application cards with a full-card open handler). */
  stopPropagation?: boolean;
};

export function JobDescriptionLink({ url, className, stopPropagation = false }: JobDescriptionLinkProps) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  function maybeStopPropagation(event: MouseEvent) {
    if (stopPropagation) {
      event.stopPropagation();
    }
  }

  async function handleCopy(event: MouseEvent) {
    maybeStopPropagation(event);
    try {
      await navigator.clipboard.writeText(trimmed);
      toast.success("Job description URL copied.");
    } catch {
      toast.error("Failed to copy URL.");
    }
  }

  return (
    <span className={cn("inline-flex items-center gap-0.5", className)}>
      <a
        href={trimmed}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-blue-600 underline underline-offset-4 hover:no-underline dark:text-blue-400"
        onClick={maybeStopPropagation}
      >
        Job Description
      </a>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground size-5 shrink-0"
        aria-label="Copy job description URL"
        onClick={(event) => void handleCopy(event)}
      >
        <CopyIcon />
      </Button>
    </span>
  );
}
