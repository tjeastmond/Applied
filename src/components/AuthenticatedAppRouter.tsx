"use client";

import { AuthenticatedApp } from "@/components/AuthenticatedApp";
import { ShellAuthenticatedApp } from "@/components/ShellAuthenticatedApp";
import { useUiShellMode } from "@/hooks/useUiShellMode";
import type { AppView } from "@/lib/appView";
import type { AuthStatus } from "@/lib/authTypes";
import type { ApplicationPageSize } from "@/lib/applicationPagination";
import type { ApplicationNote, JobApplication } from "@/types";

type AppPageProps = {
  initialApplications: JobApplication[];
  initialNotesByApplicationId: Record<string, ApplicationNote[]>;
  initialPageSize: ApplicationPageSize;
  initialPageSizeFromPreference: boolean;
  tursoSyncAvailable: boolean;
  authStatus: AuthStatus;
  routeAppView?: AppView;
  onLogout: () => void;
};

export function AuthenticatedAppRouter(props: AppPageProps) {
  const { mode, hasHydrated } = useUiShellMode();

  if (!hasHydrated) {
    return null;
  }

  const sharedProps = {
    initialApplications: props.initialApplications,
    initialNotesByApplicationId: props.initialNotesByApplicationId,
    initialPageSize: props.initialPageSize,
    initialPageSizeFromPreference: props.initialPageSizeFromPreference,
    tursoSyncAvailable: props.tursoSyncAvailable,
    onLogout: props.onLogout,
    routeAppView: props.routeAppView,
  };

  if (mode === "classic") {
    return <AuthenticatedApp {...sharedProps} />;
  }

  return <ShellAuthenticatedApp {...sharedProps} />;
}
