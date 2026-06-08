"use client";

import type { MouseEvent } from "react";
import { cn } from "@/lib/utils";

type CompanyLinkedInLinkProps = {
  url: string;
  className?: string;
  stopPropagation?: boolean;
};

export function CompanyLinkedInLink({ url, className, stopPropagation = false }: CompanyLinkedInLinkProps) {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }

  function stopBubble(event: MouseEvent) {
    if (stopPropagation) event.stopPropagation();
  }

  return (
    <a
      href={trimmed}
      target="_blank"
      rel="noopener noreferrer"
      className={cn("text-xs text-blue-600 dark:text-blue-400", className)}
      onClick={stopBubble}
    >
      LinkedIn
    </a>
  );
}
