"use client";

import { Button } from "@/components/ui/button";
import { modKShortcutDescription, modKShortcutLabel } from "@/lib/keyboardShortcut";
import { MenuIcon, PlusIcon } from "lucide-react";
import { useSidebar } from "./SidebarProvider";

type AppHeaderProps = {
  onAddApplication: () => void;
};

export function AppHeader({ onAddApplication }: AppHeaderProps) {
  const { setMobileOpen } = useSidebar();

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
