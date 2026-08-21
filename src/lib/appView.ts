import type { ApplicationViewMode } from "@/lib/applicationArchive";
import type { JobApplication } from "@/types";

export type AppView = "applications" | "toApply" | "bookmarks" | "archived";

export const PROFILE_PATH = "/profile";

export const APP_VIEW_PATHS: Record<AppView, string> = {
  applications: "/",
  toApply: "/to-apply",
  bookmarks: "/bookmarks",
  archived: "/archived",
};

export function pathToAppView(pathname: string): AppView {
  if (pathname === APP_VIEW_PATHS.toApply) return "toApply";
  if (pathname === APP_VIEW_PATHS.bookmarks) return "bookmarks";
  if (pathname === APP_VIEW_PATHS.archived) return "archived";
  return "applications";
}

export function appViewToPath(view: AppView): string {
  return APP_VIEW_PATHS[view];
}

export function isProfileRoute(pathname: string): boolean {
  return pathname === PROFILE_PATH;
}

export type AppViewQuery = {
  viewMode: ApplicationViewMode;
  bookmarksOnly: boolean;
  toApplyOnly: boolean;
};

export function appViewToQuery(view: AppView): AppViewQuery {
  switch (view) {
    case "toApply":
      return { viewMode: "active", bookmarksOnly: false, toApplyOnly: true };
    case "bookmarks":
      return { viewMode: "active", bookmarksOnly: true, toApplyOnly: false };
    case "archived":
      return { viewMode: "archived", bookmarksOnly: false, toApplyOnly: false };
    case "applications":
      return { viewMode: "active", bookmarksOnly: false, toApplyOnly: false };
    default: {
      const exhaustive: never = view;
      return exhaustive;
    }
  }
}

export function shouldShowIncludeArchived(options: {
  routeAppView?: AppView;
  viewMode: ApplicationViewMode;
  bookmarksOnly: boolean;
}): boolean {
  if (options.routeAppView !== undefined) {
    return options.routeAppView === "applications";
  }

  return options.viewMode === "active" && !options.bookmarksOnly;
}

export function companyFilterNavigatesHome(routeAppView: AppView | undefined): boolean {
  return routeAppView !== undefined && routeAppView !== "applications";
}

export type NavCounts = {
  applications: number;
  toApply: number;
  bookmarked: number;
  archived: number;
};

export function computeNavCounts(applications: readonly JobApplication[]): NavCounts {
  const active = applications.filter((application) => !application.archived);
  return {
    applications: active.length,
    toApply: active.filter((application) => application.status === "to_apply").length,
    bookmarked: active.filter((application) => application.pinned).length,
    archived: applications.filter((application) => application.archived).length,
  };
}
