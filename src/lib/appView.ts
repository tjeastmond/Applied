import type { ApplicationViewMode } from "@/lib/applicationArchive";
import type { JobApplication } from "@/types";

export type AppView = "applications" | "bookmarks" | "archived";

export const PROFILE_PATH = "/profile";

export const APP_VIEW_PATHS: Record<AppView, string> = {
  applications: "/",
  bookmarks: "/bookmarks",
  archived: "/archived",
};

export function pathToAppView(pathname: string): AppView {
  if (pathname === "/bookmarks") return "bookmarks";
  if (pathname === "/archived") return "archived";
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
};

export function appViewToQuery(view: AppView): AppViewQuery {
  switch (view) {
    case "bookmarks":
      return { viewMode: "active", bookmarksOnly: true };
    case "archived":
      return { viewMode: "archived", bookmarksOnly: false };
    case "applications":
      return { viewMode: "active", bookmarksOnly: false };
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

export type NavCounts = {
  applications: number;
  bookmarked: number;
  archived: number;
};

export function computeNavCounts(applications: readonly JobApplication[]): NavCounts {
  const active = applications.filter((application) => !application.archived);
  return {
    applications: active.length,
    bookmarked: active.filter((application) => application.pinned).length,
    archived: applications.filter((application) => application.archived).length,
  };
}
