export const APPLICATION_STATUSES = ["applied", "interviewing", "rejected", "offer", "passed"] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

const STATUS_OPTIONS_BY_VALUE: { value: ApplicationStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "rejected", label: "Rejected" },
  { value: "offer", label: "Offer" },
  { value: "passed", label: "Passed" },
];

export const APPLICATION_STATUS_OPTIONS = [
  STATUS_OPTIONS_BY_VALUE.find((option) => option.value === "applied")!,
  ...STATUS_OPTIONS_BY_VALUE.filter((option) => option.value !== "applied").sort((a, b) =>
    a.label.localeCompare(b.label),
  ),
];

const STATUS_TAG_CLASSES: Record<ApplicationStatus, string> = {
  applied:
    "border-slate-200 bg-slate-100 text-slate-700 aria-expanded:ring-slate-300/50 focus-visible:border-slate-300 focus-visible:ring-slate-300/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
  interviewing:
    "border-blue-200 bg-blue-100 text-blue-800 aria-expanded:ring-blue-300/50 focus-visible:border-blue-300 focus-visible:ring-blue-300/40 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200",
  rejected:
    "border-red-200 bg-red-100 text-red-800 aria-expanded:ring-red-300/50 focus-visible:border-red-300 focus-visible:ring-red-300/40 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
  offer:
    "border-green-200 bg-green-100 text-green-800 aria-expanded:ring-green-300/50 focus-visible:border-green-300 focus-visible:ring-green-300/40 dark:border-green-900 dark:bg-green-950 dark:text-green-200",
  passed:
    "border-violet-200 bg-violet-100 text-violet-800 aria-expanded:ring-violet-300/50 focus-visible:border-violet-300 focus-visible:ring-violet-300/40 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200",
};

const STATUS_DOT_CLASSES: Record<ApplicationStatus, string> = {
  applied: "bg-slate-500",
  interviewing: "bg-blue-500",
  rejected: "bg-red-500",
  offer: "bg-green-600",
  passed: "bg-violet-500",
};

export function statusLabel(status: ApplicationStatus): string {
  return APPLICATION_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function statusTagClassName(status: ApplicationStatus): string {
  return STATUS_TAG_CLASSES[status];
}

export function statusDotClassName(status: ApplicationStatus): string {
  return STATUS_DOT_CLASSES[status];
}
