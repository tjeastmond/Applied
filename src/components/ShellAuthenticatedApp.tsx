"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnalyticsPage } from "@/components/analytics/AnalyticsPage";
import { ApplicationListPage } from "@/components/ApplicationListPage";
import { CompanyListPage } from "@/components/companies/CompanyListPage";
import { AuthenticatedAppOverlays } from "@/components/AuthenticatedAppOverlays";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { ProfilePage } from "@/components/shell/ProfilePage";
import { SettingsDialog, type SettingsSection } from "@/components/shell/SettingsDialog";
import { SidebarProvider } from "@/components/shell/SidebarProvider";
import type { AuthenticatedAppControllerOptions } from "@/hooks/useAuthenticatedAppController";
import { useAuthenticatedAppController } from "@/hooks/useAuthenticatedAppController";
import { resolveCompaniesRouteViewMode, useCompaniesController } from "@/hooks/useCompaniesController";
import { useUiShellMode } from "@/hooks/useUiShellMode";
import { isAnalyticsRoute } from "@/lib/analytics";
import { isCompaniesRoute } from "@/lib/companies";
import { appViewToPath, computeNavCounts, isProfileRoute, pathToAppView, PROFILE_PATH } from "@/lib/appView";
import { SHELL_LIST_EDGE_BLEED_CLASS } from "@/lib/listPageLayout";
import type { Company, User } from "@/types";

type ShellAuthenticatedAppProps = Omit<AuthenticatedAppControllerOptions, "routeAppView" | "navigateToApplications"> & {
  initialCurrentUser: User;
  initialCompanies: Company[];
  onLogout: () => void;
  tursoSyncAvailable: boolean;
};

export function ShellAuthenticatedApp({
  onLogout,
  tursoSyncAvailable,
  initialCurrentUser,
  initialCompanies,
  ...controllerOptions
}: ShellAuthenticatedAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const routeAppView = useMemo(() => pathToAppView(pathname), [pathname]);
  const onAnalyticsRoute = isAnalyticsRoute(pathname);
  const onCompaniesRoute = isCompaniesRoute(pathname);
  const onProfileRoute = isProfileRoute(pathname);
  const companiesRouteViewMode = useMemo(() => resolveCompaniesRouteViewMode(pathname), [pathname]);

  const navigateToApplications = useCallback(() => {
    if (routeAppView !== "applications") {
      router.push(appViewToPath("applications"));
    }
  }, [routeAppView, router]);

  const controller = useAuthenticatedAppController({
    ...controllerOptions,
    routeAppView,
    navigateToApplications,
  });
  const companiesController = useCompaniesController({
    initialCompanies,
    applications: controller.applications,
    routeViewMode: companiesRouteViewMode,
  });
  const { mode: uiShellMode, toggleMode: toggleUiShellMode } = useUiShellMode();
  const [currentUser, setCurrentUser] = useState(initialCurrentUser);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");

  useEffect(() => {
    setCurrentUser(initialCurrentUser);
  }, [initialCurrentUser]);

  const navCounts = useMemo(() => computeNavCounts(controller.applications), [controller.applications]);
  const companiesCount = useMemo(
    () => companiesController.companies.filter((company) => !company.ignored).length,
    [companiesController.companies],
  );

  const handleOpenSettings = useCallback((section: SettingsSection = "general") => {
    setSettingsSection(section);
    setSettingsOpen(true);
  }, []);

  const handleResetToHome = useCallback(() => {
    controller.resetToHome();
    router.push(appViewToPath("applications"));
  }, [controller, router]);

  const handleBackToApplications = useCallback(() => {
    controller.clearFilters();
    router.push(appViewToPath("applications"));
  }, [controller, router]);

  const handleOpenProfile = useCallback(() => {
    router.push(PROFILE_PATH);
  }, [router]);

  const handleLeaveProfile = useCallback(() => {
    router.push(appViewToPath("applications"));
  }, [router]);

  const handleUserUpdated = useCallback((user: User) => {
    setCurrentUser(user);
  }, []);

  const handleOpenApplicationFromCompany = useCallback(
    (applicationId: string) => {
      const application = controller.applications.find((item) => item.id === applicationId);
      if (!application) return;

      if (application.archived && controller.viewMode === "active" && !controller.includeArchived) {
        controller.handleIncludeArchivedChange(true);
      }

      companiesController.setDetailOpen(false);

      if (onCompaniesRoute) {
        router.push(appViewToPath("applications"));
      }

      controller.handleOpenApplication(applicationId);
    },
    [companiesController.setDetailOpen, controller, onCompaniesRoute, router],
  );

  return (
    <SidebarProvider>
      <div className="bg-background flex h-svh overflow-hidden">
        <AppSidebar
          currentUser={currentUser}
          navCounts={navCounts}
          companiesCount={companiesCount}
          uiShellMode={uiShellMode}
          onToggleUiShellMode={toggleUiShellMode}
          onLogout={onLogout}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={handleOpenSettings}
          onLogoClick={handleResetToHome}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader onAddApplication={controller.openAddForm} onLogoClick={handleResetToHome} />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            {onAnalyticsRoute ? (
              <AnalyticsPage applications={controller.applications} onAddApplication={controller.openAddForm} />
            ) : onProfileRoute ? (
              <ProfilePage user={currentUser} onUserUpdated={handleUserUpdated} onCancel={handleLeaveProfile} />
            ) : onCompaniesRoute ? (
              <CompanyListPage
                {...companiesController}
                edgeBleedClassName={SHELL_LIST_EDGE_BLEED_CLASS}
                onOpenApplication={handleOpenApplicationFromCompany}
              />
            ) : (
              <ApplicationListPage
                {...controller}
                onBackToApplications={handleBackToApplications}
                edgeBleedClassName={SHELL_LIST_EDGE_BLEED_CLASS}
                showListFooter={false}
              />
            )}
          </main>
        </div>
      </div>

      <AuthenticatedAppOverlays {...controller} />

      <SettingsDialog
        applications={controller.applications}
        onImported={controller.handleBackupImported}
        onApplicationsUpdated={controller.handleApplicationsUpdated}
        tursoSyncAvailable={tursoSyncAvailable}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        initialSection={settingsSection}
        uiShellMode={uiShellMode}
        onToggleUiShellMode={toggleUiShellMode}
      />
    </SidebarProvider>
  );
}
