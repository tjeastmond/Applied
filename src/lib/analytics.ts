import { APPLICATION_STATUSES, APPLICATION_STATUS_OPTIONS, type ApplicationStatus } from "@/lib/applicationStatus";
import {
  ANALYTICS_RANGES,
  type AnalyticsFilters,
  type AnalyticsRange,
  type AnalyticsResponse,
} from "@/lib/schemas/analytics";

export type { AnalyticsFilters, AnalyticsRange, AnalyticsResponse };

export const ANALYTICS_PATH = "/analytics";
export const DEFAULT_ANALYTICS_RANGE = "90d";

export const ANALYTICS_RANGE_OPTIONS = [
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "6m", label: "Last 6 Months" },
  { value: "12m", label: "Last 12 Months" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom Range" },
] as const;

const ANALYTICS_RANGE_SET = new Set<AnalyticsRange>(ANALYTICS_RANGES);
const APPLICATION_STATUS_SET = new Set<ApplicationStatus>(APPLICATION_STATUSES);
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function uniqueNonEmpty(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function isAnalyticsRange(value: string | null): value is AnalyticsRange {
  return value !== null && ANALYTICS_RANGE_SET.has(value as AnalyticsRange);
}

function isApplicationStatus(value: string): value is ApplicationStatus {
  return APPLICATION_STATUS_SET.has(value as ApplicationStatus);
}

function isIsoDate(value: string | null): value is string {
  if (value === null || !ISO_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function defaultAnalyticsFilters(): AnalyticsFilters {
  return {
    range: DEFAULT_ANALYTICS_RANGE,
    companies: [],
    statuses: [],
    includeArchived: true,
  };
}

export function parseAnalyticsFilters(searchParams: URLSearchParams): AnalyticsFilters {
  const requestedRange = searchParams.get("range");
  const range = isAnalyticsRange(requestedRange) ? requestedRange : DEFAULT_ANALYTICS_RANGE;
  const from = range === "custom" && isIsoDate(searchParams.get("from")) ? searchParams.get("from")! : undefined;
  const to = range === "custom" && isIsoDate(searchParams.get("to")) ? searchParams.get("to")! : undefined;

  return {
    range,
    companies: uniqueNonEmpty(searchParams.getAll("company")),
    statuses: uniqueNonEmpty(searchParams.getAll("status")).filter(isApplicationStatus),
    includeArchived: searchParams.get("archived") !== "0",
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
}

export function analyticsFiltersToSearchParams(filters: AnalyticsFilters): URLSearchParams {
  const searchParams = new URLSearchParams();

  if (filters.range !== DEFAULT_ANALYTICS_RANGE) {
    searchParams.set("range", filters.range);
  }
  for (const company of uniqueNonEmpty(filters.companies)) {
    searchParams.append("company", company);
  }
  for (const status of uniqueNonEmpty(filters.statuses).filter(isApplicationStatus)) {
    searchParams.append("status", status);
  }
  if (!filters.includeArchived) {
    searchParams.set("archived", "0");
  }
  if (filters.range === "custom") {
    if (filters.from && isIsoDate(filters.from)) searchParams.set("from", filters.from);
    if (filters.to && isIsoDate(filters.to)) searchParams.set("to", filters.to);
  }

  return searchParams;
}

export function analyticsFiltersToUrl(filters: AnalyticsFilters): string {
  const query = analyticsFiltersToSearchParams(filters).toString();
  return `${ANALYTICS_PATH}${query ? `?${query}` : ""}`;
}

export function analyticsStatusesByActivity(status: AnalyticsResponse["status"]) {
  const countByStatus = new Map(status.map((item) => [item.status, item.count]));

  return APPLICATION_STATUS_OPTIONS.map((option, labelOrder) => ({
    option,
    labelOrder,
    count: countByStatus.get(option.value) ?? 0,
  }))
    .sort((left, right) => right.count - left.count || left.labelOrder - right.labelOrder)
    .map(({ option }) => option);
}

export function analyticsRelativeBarScale(count: number, maximum: number): number {
  if (count <= 0) return 0;
  return Math.max(0.03, Math.min(1, count / Math.max(1, maximum)));
}

export function analyticsVolumeLabelIndexes(bucketCount: number, maximumLabels = 6): Set<number> {
  if (bucketCount <= 0 || maximumLabels <= 0) return new Set();
  if (bucketCount <= maximumLabels) return new Set(Array.from({ length: bucketCount }, (_, index) => index));
  if (maximumLabels === 1) return new Set([0]);

  return new Set(
    Array.from({ length: maximumLabels }, (_, index) => Math.round((index * (bucketCount - 1)) / (maximumLabels - 1))),
  );
}

export function formatAnalyticsVolumeTickLabel(isoDate: string): string {
  if (!ISO_DATE_PATTERN.test(isoDate)) return isoDate;

  const date = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== isoDate) return isoDate;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function isInvalidAnalyticsDateRange(filters: AnalyticsFilters): boolean {
  return (
    filters.range === "custom" && filters.from !== undefined && filters.to !== undefined && filters.from > filters.to
  );
}

export function isIncompleteAnalyticsDateRange(filters: AnalyticsFilters): boolean {
  return filters.range === "custom" && (filters.from === undefined || filters.to === undefined);
}

export function isAnalyticsRoute(pathname: string): boolean {
  return pathname === ANALYTICS_PATH;
}

export function hasActiveAnalyticsFilters(filters: AnalyticsFilters): boolean {
  return (
    filters.range !== DEFAULT_ANALYTICS_RANGE ||
    filters.companies.length > 0 ||
    filters.statuses.length > 0 ||
    !filters.includeArchived ||
    filters.from !== undefined ||
    filters.to !== undefined
  );
}

export function formatAnalyticsCount(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("en-US").format(value);
}

export function formatAnalyticsCompanyCount(value: number): string {
  return `${formatAnalyticsCount(value)} ${value === 1 ? "company" : "companies"}`;
}

export function formatAnalyticsRate(value: number | null): string {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(value / 100);
}
