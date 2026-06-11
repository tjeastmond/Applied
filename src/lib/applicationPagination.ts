export const APPLICATION_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

export type ApplicationNumericPageSize = (typeof APPLICATION_PAGE_SIZE_OPTIONS)[number];

export const APPLICATION_VIEW_ALL_PAGE_SIZE = "all" as const;

export type ApplicationPageSize = ApplicationNumericPageSize | typeof APPLICATION_VIEW_ALL_PAGE_SIZE;

export const DEFAULT_APPLICATION_PAGE_SIZE: ApplicationPageSize = 10;

export const APPLICATION_PAGE_SIZE_STORAGE_KEY = "applied-dev-page-size";

export type PaginatedSlice<T> = {
  items: T[];
  page: number;
  pageSize: ApplicationPageSize;
  totalCount: number;
  totalPages: number;
  rangeStart: number;
  rangeEnd: number;
};

export function isApplicationNumericPageSize(value: number): value is ApplicationNumericPageSize {
  return (APPLICATION_PAGE_SIZE_OPTIONS as readonly number[]).includes(value);
}

export function isApplicationPageSize(value: string | number | null | undefined): value is ApplicationPageSize {
  if (value === APPLICATION_VIEW_ALL_PAGE_SIZE) return true;
  if (typeof value === "number") return isApplicationNumericPageSize(value);
  if (typeof value !== "string" || value.length === 0) return false;
  if (value === APPLICATION_VIEW_ALL_PAGE_SIZE) return true;
  const parsed = Number.parseInt(value, 10);
  return isApplicationNumericPageSize(parsed);
}

export function parseApplicationPageSize(value: string | null | undefined): ApplicationPageSize | null {
  if (value === APPLICATION_VIEW_ALL_PAGE_SIZE) return APPLICATION_VIEW_ALL_PAGE_SIZE;
  if (typeof value !== "string" || value.length === 0) return null;
  const parsed = Number.parseInt(value, 10);
  return isApplicationNumericPageSize(parsed) ? parsed : null;
}

export function readStoredApplicationPageSize(): ApplicationPageSize {
  if (typeof window === "undefined") return DEFAULT_APPLICATION_PAGE_SIZE;

  try {
    const stored = localStorage.getItem(APPLICATION_PAGE_SIZE_STORAGE_KEY);
    return parseApplicationPageSize(stored) ?? DEFAULT_APPLICATION_PAGE_SIZE;
  } catch {
    return DEFAULT_APPLICATION_PAGE_SIZE;
  }
}

const APPLICATION_PAGE_SIZE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

export function persistApplicationPageSizeCookie(pageSize: ApplicationPageSize): void {
  if (typeof document === "undefined") return;

  try {
    document.cookie = `${APPLICATION_PAGE_SIZE_STORAGE_KEY}=${encodeURIComponent(String(pageSize))};path=/;max-age=${APPLICATION_PAGE_SIZE_COOKIE_MAX_AGE_SECONDS};SameSite=Lax`;
  } catch {
    // Ignore cookie failures (blocked storage, etc.)
  }
}

export function persistApplicationPageSize(pageSize: ApplicationPageSize): void {
  try {
    localStorage.setItem(APPLICATION_PAGE_SIZE_STORAGE_KEY, String(pageSize));
  } catch {
    // Ignore storage failures (private browsing, quota, etc.)
  }

  persistApplicationPageSizeCookie(pageSize);
}

export function applicationPageSizeInitScript(): string {
  return `(function(){try{var ps=localStorage.getItem("${APPLICATION_PAGE_SIZE_STORAGE_KEY}");if(!ps)return;document.cookie="${APPLICATION_PAGE_SIZE_STORAGE_KEY}="+encodeURIComponent(ps)+";path=/;max-age=${APPLICATION_PAGE_SIZE_COOKIE_MAX_AGE_SECONDS};SameSite=Lax"}catch(e){}})();`;
}

export function applicationPageSizeTriggerLabel(pageSize: ApplicationPageSize): string {
  if (pageSize === APPLICATION_VIEW_ALL_PAGE_SIZE) return "View all";
  return `${pageSize} per page`;
}

export function applicationPageSizeMenuLabel(pageSize: ApplicationPageSize): string {
  if (pageSize === APPLICATION_VIEW_ALL_PAGE_SIZE) return "View all";
  return String(pageSize);
}

function effectivePageSize(pageSize: ApplicationPageSize, totalCount: number): number {
  if (pageSize === APPLICATION_VIEW_ALL_PAGE_SIZE) return Math.max(totalCount, 1);
  return pageSize;
}

export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) return 1;
  if (totalPages < 1) return 1;
  return Math.min(Math.floor(page), totalPages);
}

export function paginateItems<T>(items: readonly T[], page: number, pageSize: ApplicationPageSize): PaginatedSlice<T> {
  const totalCount = items.length;
  const resolvedPageSize = effectivePageSize(pageSize, totalCount);
  const totalPages = Math.max(1, Math.ceil(totalCount / resolvedPageSize));
  const safePage = clampPage(page, totalPages);
  const startIndex = (safePage - 1) * resolvedPageSize;
  const endIndex = Math.min(startIndex + resolvedPageSize, totalCount);

  return {
    items: items.slice(startIndex, endIndex),
    page: safePage,
    pageSize,
    totalCount,
    totalPages,
    rangeStart: totalCount === 0 ? 0 : startIndex + 1,
    rangeEnd: endIndex,
  };
}

export function formatApplicationPageRange(rangeStart: number, rangeEnd: number, totalCount: number): string {
  if (totalCount === 0) return "No applications";
  if (rangeStart === rangeEnd) return `${rangeStart} of ${totalCount}`;
  return `${rangeStart}–${rangeEnd} of ${totalCount}`;
}
