"use client";

import { memo, useCallback, type MouseEvent } from "react";
import { ApplicationMetadataLine } from "@/components/ApplicationMetadataLine";
import { ApplicationStatusPicker } from "@/components/ApplicationStatusPicker";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/applicationForm";
import { applicationCardPropsEqual } from "@/lib/applicationCardEquality";
import { APPLICATION_CARD_HIGHLIGHT_CLASSES } from "@/lib/applicationCardStyles";
import { cn } from "@/lib/utils";
import type { ApplicationStatus, JobApplication } from "@/types";
import { BookmarkIcon } from "lucide-react";

type ApplicationCardProps = {
  application: JobApplication;
  keyboardHighlighted?: boolean;
  onOpen: (id: string) => void;
  onPrefetchNotes: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onPinChange: (id: string, pinned: boolean) => void;
  onMouseEnterCard?: (id: string) => void;
  onMouseLeaveCard?: () => void;
};

export const ApplicationCard = memo(function ApplicationCard({
  application,
  keyboardHighlighted = false,
  onOpen,
  onPrefetchNotes,
  onStatusChange,
  onPinChange,
  onMouseEnterCard,
  onMouseLeaveCard,
}: ApplicationCardProps) {
  const { id } = application;
  const title = application.title || application.url;
  const appliedLabel = formatDate(application.appliedAt);
  const postingUrl = application.url.trim();

  const handleOpen = useCallback(() => onOpen(id), [id, onOpen]);
  const handlePrefetch = useCallback(() => onPrefetchNotes(id), [id, onPrefetchNotes]);
  const handleMouseEnterCard = useCallback(() => onMouseEnterCard?.(id), [id, onMouseEnterCard]);
  const handleMouseLeaveCard = useCallback(() => onMouseLeaveCard?.(), [onMouseLeaveCard]);
  const handleStatusChange = useCallback(
    (status: ApplicationStatus) => onStatusChange(id, status),
    [id, onStatusChange],
  );
  const handlePinToggle = useCallback(
    (event: MouseEvent) => {
      event.stopPropagation();
      onPinChange(id, !application.pinned);
    },
    [application.pinned, id, onPinChange],
  );

  return (
    <Card
      data-application-id={id}
      className={cn(
        "application-card relative gap-0 py-0 transition-colors",
        "hover:bg-muted/50 dark:hover:bg-secondary hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/30",
        keyboardHighlighted && APPLICATION_CARD_HIGHLIGHT_CLASSES,
        "group-data-[scroll-hover-locked]/list:hover:bg-transparent group-data-[scroll-hover-locked]/list:dark:hover:bg-transparent",
        "group-data-[scroll-hover-locked]/list:hover:shadow-none group-data-[scroll-hover-locked]/list:dark:hover:shadow-none",
        keyboardHighlighted &&
          "group-data-[scroll-hover-locked]/list:bg-muted/50 group-data-[scroll-hover-locked]/list:dark:bg-secondary group-data-[scroll-hover-locked]/list:shadow-md group-data-[scroll-hover-locked]/list:shadow-black/5 group-data-[scroll-hover-locked]/list:dark:shadow-black/30",
      )}
      onMouseEnter={handleMouseEnterCard}
      onMouseLeave={handleMouseLeaveCard}
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
          <div className="flex items-center gap-1">
            {!application.archived ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  "pointer-events-auto -ml-1 shrink-0",
                  "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-label={application.pinned ? "Remove bookmark" : "Bookmark application"}
                title={application.pinned ? "Remove Bookmark" : "Bookmark"}
                onClick={handlePinToggle}
              >
                <BookmarkIcon className={cn(application.pinned && "fill-current")} />
              </Button>
            ) : null}
            <ApplicationMetadataLine
              variant="card"
              company={application.company}
              appliedLabel={appliedLabel}
              linkedinUrl={application.linkedinUrl}
              postingUrl={postingUrl}
              stopPropagation
              className="min-w-0 flex-1"
            />
          </div>
        </div>
        <div className="pointer-events-auto shrink-0">
          <ApplicationStatusPicker status={application.status} onStatusChange={handleStatusChange} />
        </div>
      </CardHeader>
    </Card>
  );
}, applicationCardPropsEqual);
