"use client";

import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApplicationListPage } from "@/components/ApplicationListPage";
import { AuthenticatedAppOverlays } from "@/components/AuthenticatedAppOverlays";
import { AppHeader } from "@/components/shell/AppHeader";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { SettingsDialog, type SettingsSection } from "@/components/shell/SettingsDialog";
import { SidebarProvider } from "@/components/shell/SidebarProvider";
import type { AuthenticatedAppControllerOptions } from "@/hooks/useAuthenticatedAppController";
import { useAuthenticatedAppController } from "@/hooks/useAuthenticatedAppController";
import { useUiShellMode } from "@/hooks/useUiShellMode";
import { appViewToPath, computeNavCounts, pathToAppView } from "@/lib/appView";

type ShellAuthenticatedAppProps = Omit<AuthenticatedAppControllerOptions, "routeAppView"> & {
  onLogout: () => void;
  tursoSyncAvailable: boolean;
};

export function ShellAuthenticatedApp({
  onLogout,
  tursoSyncAvailable,
  ...controllerOptions
}: ShellAuthenticatedAppProps) {
  const router = useRouter();
  const pathname = usePathname();
  const routeAppView = useMemo(() => pathToAppView(pathname), [pathname]);
  const controller = useAuthenticatedAppController({ ...controllerOptions, routeAppView });
  const { mode: uiShellMode, toggleMode: toggleUiShellMode } = useUiShellMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("general");

  const navCounts = useMemo(() => computeNavCounts(controller.applications), [controller.applications]);

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

  return (
    <SidebarProvider>
      <div className="bg-background flex h-svh overflow-hidden">
        <AppSidebar
          navCounts={navCounts}
          uiShellMode={uiShellMode}
          onToggleUiShellMode={toggleUiShellMode}
          onLogout={onLogout}
          onOpenSettings={handleOpenSettings}
          onLogoClick={handleResetToHome}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <AppHeader onAddApplication={controller.openAddForm} />
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <ApplicationListPage
              {...controller}
              onBackToApplications={handleBackToApplications}
              edgeBleedClassName="-mx-4 sm:-mx-6 lg:-mx-8"
            />
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
