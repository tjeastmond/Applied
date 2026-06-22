import { renderBasicMarkdown } from "@/lib/basicMarkdown";
import { cn } from "@/lib/utils";

export function NoteContent({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("note-markdown max-w-full min-w-0 space-y-2 text-sm", className)}>
      {renderBasicMarkdown(content)}
    </div>
  );
}
