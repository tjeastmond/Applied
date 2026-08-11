"use client";

import { Menu } from "@base-ui/react/menu";
import { useTheme } from "@/components/ThemeProvider";
import type { UiShellMode } from "@/hooks/useUiShellMode";
import { cn } from "@/lib/utils";
import { ChevronsUpDown, LayoutTemplate, LogOut, Moon, Sun } from "lucide-react";

type ProfileMenuProps = {
  name: string;
  email: string;
  collapsed?: boolean;
  uiShellMode: UiShellMode;
  onToggleUiShellMode: () => void;
  onLogout: () => void;
};

function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileMenu({
  name,
  email,
  collapsed = false,
  uiShellMode,
  onToggleUiShellMode,
  onLogout,
}: ProfileMenuProps) {
  const initials = initialsFrom(name);
  const { theme, toggleTheme } = useTheme();

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-transparent p-1.5 text-left transition-colors outline-none",
          "hover:border-border hover:bg-accent focus-visible:border-border focus-visible:bg-accent",
          collapsed && "justify-center",
        )}
        aria-label="Open account menu"
      >
        <span
          aria-hidden
          className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
        >
          {initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="text-foreground block truncate text-xs font-medium">{name}</span>
              <span className="text-muted-foreground block truncate text-[0.7rem]">{email}</span>
            </span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
          </>
        )}
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="top" align="start" sideOffset={8} className="z-50">
          <Menu.Popup className="bg-popover text-popover-foreground border-border min-w-56 rounded-lg border p-1 shadow-xl outline-none">
            <div className="flex items-center gap-2.5 px-2 py-2">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium">{name}</p>
                <p className="text-muted-foreground truncate text-[0.7rem]">{email}</p>
              </div>
            </div>

            <div className="bg-border my-1 h-px" />

            <Menu.Item
              closeOnClick={false}
              className="data-[highlighted]:bg-accent data-[highlighted]:text-foreground flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none"
              onClick={toggleTheme}
            >
              {theme === "dark" ? (
                <Moon className="text-muted-foreground size-4" />
              ) : (
                <Sun className="text-muted-foreground size-4" />
              )}
              <span className="flex-1">Theme</span>
              <span className="text-muted-foreground text-[0.7rem]">{theme === "dark" ? "Dark" : "Light"}</span>
            </Menu.Item>

            <Menu.Item
              closeOnClick={false}
              className="data-[highlighted]:bg-accent data-[highlighted]:text-foreground flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none"
              onClick={onToggleUiShellMode}
            >
              <LayoutTemplate className="text-muted-foreground size-4" />
              <span className="flex-1">{uiShellMode === "shell" ? "Switch to Classic UI" : "Switch to New UI"}</span>
            </Menu.Item>

            <div className="bg-border my-1 h-px" />

            <Menu.Item
              className="text-destructive data-[highlighted]:bg-destructive/10 flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none"
              onClick={onLogout}
            >
              <LogOut className="size-4" />
              Log Out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
