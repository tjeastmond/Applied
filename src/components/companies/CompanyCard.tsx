"use client";

import { memo, useCallback, type MouseEvent } from "react";
import { CompanyLinkedInLink } from "@/components/CompanyLinkedInLink";
import { MetadataDot } from "@/components/MetadataDot";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { countApplicationsForCompany } from "@/lib/companies";
import { cn } from "@/lib/utils";
import type { Company, JobApplication } from "@/types";
import { BanIcon, Building2Icon } from "lucide-react";

type CompanyCardProps = {
  company: Company;
  applications: JobApplication[];
  onOpen: (id: string) => void;
  onToggleIgnored: (id: string, ignored: boolean) => void;
};

export const CompanyCard = memo(function CompanyCard({
  company,
  applications,
  onOpen,
  onToggleIgnored,
}: CompanyCardProps) {
  const { id, name, url, linkedinUrl } = company;
  const applicationCount = countApplicationsForCompany(applications, name);
  const websiteUrl = url?.trim() ?? "";
  const linkedin = linkedinUrl?.trim() ?? "";

  const handleOpen = useCallback(() => onOpen(id), [id, onOpen]);
  const handleToggleIgnored = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onToggleIgnored(id, !company.ignored);
    },
    [company.ignored, id, onToggleIgnored],
  );

  return (
    <Card className="application-card hover:bg-muted/50 dark:hover:bg-secondary relative min-w-0 gap-0 py-0 transition-colors hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30">
      <button
        type="button"
        className="application-card-hit focus-visible:ring-ring/50 absolute inset-0 z-0 rounded-xl focus-visible:ring-3 focus-visible:outline-none"
        aria-label={`View details for ${name}`}
        onClick={handleOpen}
      />
      <CardHeader className="pointer-events-none relative z-10 flex flex-row items-start justify-between gap-3 space-y-0 py-4">
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <CardTitle className="truncate text-base" title={name}>
            {name}
          </CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-1.5 text-xs">
            <Building2Icon className="size-3.5 shrink-0" />
            <span>
              {applicationCount} {applicationCount === 1 ? "Application" : "Applications"}
            </span>
            {websiteUrl ? (
              <>
                <MetadataDot size="sm" />
                <a
                  href={websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto text-blue-600 dark:text-blue-400"
                  onClick={(event) => event.stopPropagation()}
                >
                  Website
                </a>
              </>
            ) : null}
            {linkedin ? (
              <>
                <MetadataDot size="sm" />
                <CompanyLinkedInLink url={linkedin} className="pointer-events-auto" stopPropagation />
              </>
            ) : null}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            "pointer-events-auto shrink-0",
            company.ignored ? "text-destructive hover:text-destructive" : "text-muted-foreground hover:text-foreground",
          )}
          aria-label={company.ignored ? "Remove From Ignore List" : "Ignore Company"}
          title={company.ignored ? "Remove From Ignore List" : "Ignore Company"}
          onClick={handleToggleIgnored}
        >
          <BanIcon className={cn(company.ignored && "fill-current")} />
        </Button>
      </CardHeader>
    </Card>
  );
});
