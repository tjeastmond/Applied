"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthenticatedApp } from "@/components/AuthenticatedApp";
import { ShellAuthenticatedApp } from "@/components/ShellAuthenticatedApp";
import { useUiShellMode } from "@/hooks/useUiShellMode";
import { isAnalyticsRoute } from "@/lib/analytics";
import type { AppView } from "@/lib/appView";
import type { AuthStatus } from "@/lib/authTypes";
import type { ApplicationPageSize } from "@/lib/applicationPagination";
import type { ApplicationNote, JobApplication, User } from "@/types";

type AppPageProps = {
  initialApplications: JobApplication[];
  initialNotesByApplicationId: Record<string, ApplicationNote[]>;
  initialCurrentUser: User;
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  tursoSyncAvailable: boolean;
  authStatus: AuthStatus;
  routeAppView?: AppView;
  onLogout: () => void;
};

export function AuthenticatedAppRouter(props: AppPageProps) {
  const { mode, hasHydrated } = useUiShellMode();
  const pathname = usePathname();
  const router = useRouter();
  const redirectClassicAnalytics = hasHydrated && mode === "classic" && isAnalyticsRoute(pathname);

  useEffect(() => {
    if (redirectClassicAnalytics) {
      router.replace("/");
    }
  }, [redirectClassicAnalytics, router]);

  if (!hasHydrated || redirectClassicAnalytics) {
    return null;
  }

  const sharedProps = {
    initialApplications: props.initialApplications,
    initialNotesByApplicationId: props.initialNotesByApplicationId,
    initialCurrentUser: props.initialCurrentUser,
    initialPageSize: props.initialPageSize,
    initialPageSizeFromPreference: props.initialPageSizeFromPreference,
    tursoSyncAvailable: props.tursoSyncAvailable,
    onLogout: props.onLogout,
    routeAppView: props.routeAppView,
  };

  if (mode === "classic") {
    return <AuthenticatedApp {...sharedProps} routeAppView={undefined} />;
  }

  return <ShellAuthenticatedApp {...sharedProps} />;
}
