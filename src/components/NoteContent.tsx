import { Fragment } from "react";
import { splitTextWithUrls } from "@/lib/linkifyText";
import { cn } from "@/lib/utils";

export function NoteContent({ content, className }: { content: string; className?: string }) {
  const segments = splitTextWithUrls(content);

  return (
    <p className={cn("max-w-full min-w-0 overflow-hidden whitespace-pre-wrap break-words", className)}>
      {segments.map((segment, index) =>
        segment.type === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            title={segment.href}
            className="inline-block max-w-full truncate align-bottom text-blue-600 dark:text-blue-400"
          >
            {segment.label}
          </a>
        ) : (
          <Fragment key={index}>
            <span className="break-words">{segment.value}</span>
          </Fragment>
        ),
      )}
    </p>
  );
}
