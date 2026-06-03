"use client";

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
  dotSize = "md",
  className,
}: ApplicationMetadataLineProps) {
  const companyText = company?.trim() ?? "";
  const linkedin = linkedinUrl?.trim() ?? "";
  const posting = postingUrl?.trim() ?? "";
  const dateLabel = appliedLabel.trim();
  const wrapperClassName = cn("flex flex-wrap items-center gap-x-1.5", className);

  const content = (
    <>
      {companyText ? (
        <>
          <span>{companyText}</span>
          <MetadataDot size={dotSize} />
        </>
      ) : null}
      {dateLabel ? <span>{dateLabel}</span> : null}
      {linkedin ? (
        <>
          <MetadataDot size={dotSize} />
          <CompanyLinkedInLink
            url={linkedin}
            className={stopPropagation ? "pointer-events-auto" : undefined}
            stopPropagation={stopPropagation}
          />
        </>
      ) : null}
      {posting ? (
        <>
          <MetadataDot size={dotSize} />
          <JobDescriptionLink
            url={posting}
            className={stopPropagation ? "pointer-events-auto" : undefined}
            stopPropagation={stopPropagation}
          />
        </>
      ) : null}
    </>
  );

  if (variant === "sheet") {
    return <SheetDescription className={wrapperClassName}>{content}</SheetDescription>;
  }

  return <CardDescription className={wrapperClassName}>{content}</CardDescription>;
}
