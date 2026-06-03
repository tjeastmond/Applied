"use client";

import { memo, useCallback } from "react";
import { ApplicationMetadataLine } from "@/components/ApplicationMetadataLine";
import { ApplicationStatusPicker } from "@/components/ApplicationStatusPicker";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/applicationForm";
import { applicationCardPropsEqual } from "@/lib/applicationCardEquality";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobApplication } from "@/types";

type ApplicationCardProps = {
  application: JobApplication;
  onOpen: (id: string) => void;
  onPrefetchNotes: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
};

export const ApplicationCard = memo(function ApplicationCard({
  application,
  onOpen,
  onPrefetchNotes,
  onStatusChange,
}: ApplicationCardProps) {
  const { id } = application;
  const title = application.title || application.url;
  const appliedLabel = formatDate(application.appliedAt);
  const postingUrl = application.url.trim();

  const handleOpen = useCallback(() => onOpen(id), [id, onOpen]);
  const handlePrefetch = useCallback(() => onPrefetchNotes(id), [id, onPrefetchNotes]);
  const handleStatusChange = useCallback(
    (status: ApplicationStatus) => onStatusChange(id, status),
    [id, onStatusChange],
  );

  return (
    <Card
      className={cn(
        "application-card relative gap-0 py-0 transition-colors",
        "hover:bg-muted/50 dark:hover:bg-secondary hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30",
        "group-data-[scroll-hover-locked]/list:hover:bg-transparent group-data-[scroll-hover-locked]/list:dark:hover:bg-transparent",
        "group-data-[scroll-hover-locked]/list:hover:shadow-none group-data-[scroll-hover-locked]/list:dark:hover:shadow-none",
      )}
    >
      <button
        type="button"
        className={cn(
          "application-card-hit focus-visible:ring-ring/50 absolute inset-0 z-0 rounded-xl focus-visible:ring-3 focus-visible:outline-none",
          "cursor-pointer group-data-[scroll-hover-locked]/list:cursor-default",
        )}
        aria-label={`View details for ${title}`}
        onClick={handleOpen}
        onMouseEnter={handlePrefetch}
        onFocus={handlePrefetch}
      />
      <CardHeader className="pointer-events-none relative z-10 flex flex-row items-start justify-between gap-3 space-y-0 py-4">
        <div className="min-w-0 flex-1 space-y-1 text-left">
          <CardTitle className="text-base">{title}</CardTitle>
          <ApplicationMetadataLine
            variant="card"
            company={application.company}
            appliedLabel={appliedLabel}
            linkedinUrl={application.linkedinUrl}
            postingUrl={postingUrl}
            stopPropagation
          />
        </div>
        <ApplicationStatusPicker
          className="pointer-events-auto"
          status={application.status}
          onStatusChange={handleStatusChange}
        />
      </CardHeader>
    </Card>
  );
}, applicationCardPropsEqual);
