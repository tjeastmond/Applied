"use client";

import type { MouseEvent } from "react";
import { CompanyLinkedInLink } from "@/components/CompanyLinkedInLink";
import { JobDescriptionLink } from "@/components/JobDescriptionLink";
import { MetadataDot, type MetadataDotSize } from "@/components/MetadataDot";
import { CardDescription } from "@/components/ui/card";
import { SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ApplicationMetadataLineProps = {
  variant: "sheet" | "card";
  company?: string | null;
  appliedLabel?: string;
  linkedinUrl?: string | null;
  postingUrl?: string | null;
  stopPropagation?: boolean;
  onCompanyClick?: (company: string) => void;
  dotSize?: MetadataDotSize;
  className?: string;
};

export function ApplicationMetadataLine({
  variant,
  company,
  appliedLabel = "",
  linkedinUrl,
  postingUrl,
  stopPropagation = false,
  onCompanyClick,
  dotSize = "md",
  className,
}: ApplicationMetadataLineProps) {
  const companyText = company?.trim() ?? "";
  const linkedin = linkedinUrl?.trim() ?? "";
  const posting = postingUrl?.trim() ?? "";
  const dateLabel = appliedLabel.trim();
  const wrapperClassName = cn("flex flex-wrap items-center gap-x-1.5 text-xs", className);

  function handleCompanyClick(event: MouseEvent<HTMLButtonElement>) {
    if (stopPropagation) event.stopPropagation();
    onCompanyClick?.(companyText);
  }

  const content = (
    <>
      {companyText ? (
        <>
          {onCompanyClick ? (
            <button
              type="button"
              className={cn(
                "pointer-events-auto relative inline-block max-w-full text-left text-blue-600 transition-colors dark:text-blue-400",
                "after:pointer-events-none after:absolute after:bottom-[-0.25rem] after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-300 after:ease-out after:content-['']",
                "hover:after:scale-x-100 focus-visible:after:scale-x-100",
                "focus-visible:ring-ring/50 rounded-sm focus-visible:ring-3 focus-visible:outline-none",
              )}
              aria-label={`Filter by ${companyText}`}
              title={`Filter by ${companyText}`}
              onClick={handleCompanyClick}
            >
              {companyText}
            </button>
          ) : (
            <span>{companyText}</span>
          )}
        </>
      ) : null}
      {posting ? (
        <>
          {companyText ? <MetadataDot size={dotSize} /> : null}
          <JobDescriptionLink
            url={posting}
            className={stopPropagation ? "pointer-events-auto" : undefined}
            stopPropagation={stopPropagation}
          />
        </>
      ) : null}
      {linkedin ? (
        <>
          {companyText || posting ? <MetadataDot size={dotSize} /> : null}
          <CompanyLinkedInLink
            url={linkedin}
            className={stopPropagation ? "pointer-events-auto" : undefined}
            stopPropagation={stopPropagation}
          />
        </>
      ) : null}
      {dateLabel ? (
        <>
          {companyText || posting || linkedin ? <MetadataDot size={dotSize} /> : null}
          <span>{dateLabel}</span>
        </>
      ) : null}
    </>
  );

  if (variant === "sheet") {
    return <SheetDescription className={wrapperClassName}>{content}</SheetDescription>;
  }

  return <CardDescription className={wrapperClassName}>{content}</CardDescription>;
}
