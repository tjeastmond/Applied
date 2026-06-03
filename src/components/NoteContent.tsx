import { Fragment } from "react";
import { splitTextWithUrls } from "@/lib/linkifyText";
import { cn } from "@/lib/utils";

export function NoteContent({ content, className }: { content: string; className?: string }) {
  const segments = splitTextWithUrls(content);

  return (
    <p className={cn("whitespace-pre-wrap", className)}>
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400"
          >
            {segment.label}
          </a>
        ) : (
          <Fragment key={index}>{segment.value}</Fragment>
        ),
      )}
    </p>
  );
}
