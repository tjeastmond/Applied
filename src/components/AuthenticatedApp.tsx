"use client";

import { ApplicationListPage } from "@/components/ApplicationListPage";
import { AuthenticatedAppOverlays } from "@/components/AuthenticatedAppOverlays";
import { AdminDialog } from "@/components/AdminDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import type { AuthenticatedAppControllerOptions } from "@/hooks/useAuthenticatedAppController";
import { useAuthenticatedAppController } from "@/hooks/useAuthenticatedAppController";
import { useUiShellMode } from "@/hooks/useUiShellMode";
import { archiveViewToggleLabel } from "@/lib/applicationArchive";
import { modKShortcutDescription, modKShortcutLabel } from "@/lib/keyboardShortcut";
import { ArchiveIcon, ArchiveRestoreIcon, LogOutIcon, PlusIcon } from "lucide-react";

type AuthenticatedAppProps = AuthenticatedAppControllerOptions & {
  tursoSyncAvailable: boolean;
  onLogout: () => void;
};

export function AuthenticatedApp({ onLogout, tursoSyncAvailable, ...controllerOptions }: AuthenticatedAppProps) {
  const controller = useAuthenticatedAppController(controllerOptions);
  const { viewMode, resetToHome } = controller;
  const { mode: uiShellMode, toggleMode: toggleUiShellMode } = useUiShellMode();

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-10 sm:px-6">
      <header className="mb-10 flex flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-bold tracking-tight">
            <button
              type="button"
              className="hover:text-foreground/80 cursor-pointer transition-colors"
              aria-label="Clear filters and go to first page"
              onClick={resetToHome}
            >
              APPLIED.
            </button>
          </h1>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
          <ThemeToggle />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="header-toolbar-outline"
            onClick={controller.handleViewModeToggle}
            aria-label={archiveViewToggleLabel(viewMode)}
            title={archiveViewToggleLabel(viewMode)}
          >
            {viewMode === "active" ? <ArchiveIcon /> : <ArchiveRestoreIcon />}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="header-toolbar-outline"
            onClick={onLogout}
            aria-label="Log out"
            title="Log Out"
          >
            <LogOutIcon />
          </Button>
          <AdminDialog
            applications={controller.applications}
            onImported={controller.handleBackupImported}
            onApplicationsUpdated={controller.handleApplicationsUpdated}
            tursoSyncAvailable={tursoSyncAvailable}
            uiShellMode={uiShellMode}
            onToggleUiShellMode={toggleUiShellMode}
          />
          <Button type="button" onClick={controller.openAddForm} title={modKShortcutDescription()}>
            <PlusIcon data-icon="inline-start" />
            Add Application
            <kbd className="bg-primary-foreground/15 text-primary-foreground/90 pointer-events-none hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline">
              {modKShortcutLabel()}
            </kbd>
          </Button>
        </div>
      </header>

      <ApplicationListPage {...controller} edgeBleedClassName="-mx-4 sm:-mx-6" />

      <AuthenticatedAppOverlays {...controller} />
    </div>
  );
}
