import type { ApplicationViewMode } from "@/lib/applicationArchive";
import type { JobApplication } from "@/types";

export type AppView = "applications" | "bookmarks" | "archived";

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
