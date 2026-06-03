import { cn } from "@/lib/utils";

const sizeClasses = {
  sm: "text-base",
  md: "text-lg",
} as const;

export type MetadataDotSize = keyof typeof sizeClasses;

export function MetadataDot({
  size = "md",
  className,
}: {
  size?: MetadataDotSize;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "text-muted-foreground inline-flex shrink-0 items-center self-center leading-none",
        sizeClasses[size],
        className,
      )}
    >
      ·
    </span>
  );
}
