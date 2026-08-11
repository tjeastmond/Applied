"use client";

import { Button } from "@/components/ui/button";
import { modKShortcutDescription, modKShortcutLabel } from "@/lib/keyboardShortcut";
import { cn } from "@/lib/utils";
import { MenuIcon, PanelLeftOpen, PlusIcon } from "lucide-react";
import { useSidebar } from "./SidebarProvider";

type AppHeaderProps = {
  onAddApplication: () => void;
  onLogoClick: () => void;
};

export function AppHeader({ onAddApplication, onLogoClick }: AppHeaderProps) {
  const { collapsed, toggleCollapsed, setMobileOpen } = useSidebar();

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 flex h-14 items-center gap-2 border-b px-3 backdrop-blur sm:px-4">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <MenuIcon />
      </Button>

      <div
        className={cn(
          "overflow-hidden transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none lg:pointer-events-none",
          "max-w-24 opacity-100 lg:max-w-0 lg:opacity-0",
        )}
      >
        <button
          type="button"
          onClick={onLogoClick}
          className="text-foreground shrink-0 cursor-pointer py-2 text-base font-bold tracking-tight whitespace-nowrap outline-none select-none"
          aria-label="Clear filters and go to applications"
        >
          APPLIED.
        </button>
      </div>

      <div
        aria-hidden={!collapsed}
        className={cn(
          "hidden overflow-hidden transition-[max-width,opacity] duration-200 ease-out motion-reduce:transition-none lg:block",
          collapsed ? "max-w-8 opacity-100" : "max-w-0 opacity-0",
        )}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground shrink-0", !collapsed && "pointer-events-none")}
          onClick={toggleCollapsed}
          aria-label="Expand sidebar"
          title="Expand Sidebar"
          tabIndex={collapsed ? 0 : -1}
        >
          <PanelLeftOpen />
        </Button>
      </div>

      <div className="flex-1" />

      <Button type="button" onClick={onAddApplication} title={modKShortcutDescription()}>
        <PlusIcon data-icon="inline-start" />
        Add Application
        <kbd className="bg-primary-foreground/15 text-primary-foreground/90 pointer-events-none hidden rounded px-1.5 py-0.5 font-sans text-[0.65rem] font-medium tracking-wide sm:inline">
          {modKShortcutLabel()}
        </kbd>
      </Button>
    </header>
  );
}
