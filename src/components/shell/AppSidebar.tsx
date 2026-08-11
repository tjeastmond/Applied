"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ProfileMenu } from "@/components/shell/ProfileMenu";
import { useSidebar } from "@/components/shell/SidebarProvider";
import type { SettingsSection } from "@/components/shell/SettingsDialog";
import { appViewToPath, pathToAppView, type NavCounts } from "@/lib/appView";
import type { UiShellMode } from "@/hooks/useUiShellMode";
import { cn } from "@/lib/utils";
import {
  Archive,
  BarChart3,
  Bookmark,
  Briefcase,
  DatabaseBackup,
  PanelLeftClose,
  RefreshCw,
  Settings,
  UserMinus,
  Users,
} from "lucide-react";

type NavItemConfig = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  count?: number;
  opensSettings?: SettingsSection;
};

type NavSection = {
  heading: string;
  items: NavItemConfig[];
};

type AppSidebarProps = {
  navCounts: NavCounts;
  uiShellMode: UiShellMode;
  onToggleUiShellMode: () => void;
  onLogout: () => void;
  onOpenSettings: (section?: SettingsSection) => void;
  onLogoClick: () => void;
};

const PLACEHOLDER_USER = {
  name: "You",
  email: "hello@swoo.io",
};

function buildSections(counts: NavCounts): NavSection[] {
  return [
    {
      heading: "Workspace",
      items: [
        { label: "Applications", icon: Briefcase, href: appViewToPath("applications"), count: counts.applications },
        { label: "Bookmarked", icon: Bookmark, href: appViewToPath("bookmarks"), count: counts.bookmarked },
        { label: "Archived", icon: Archive, href: appViewToPath("archived"), count: counts.archived },
        { label: "Analytics", icon: BarChart3, href: appViewToPath("applications") },
      ],
    },
    {
      heading: "Admin",
      items: [
        { label: "Manage Users", icon: Users, href: appViewToPath("applications") },
        { label: "Reset Cache", icon: RefreshCw, href: appViewToPath("applications") },
        { label: "Off-Boarding", icon: UserMinus, href: appViewToPath("applications") },
        { label: "Backup Data", icon: DatabaseBackup, href: "#", opensSettings: "data" },
        { label: "Settings", icon: Settings, href: "#", opensSettings: "general" },
      ],
    },
  ];
}

export function AppSidebar({
  navCounts,
  uiShellMode,
  onToggleUiShellMode,
  onLogout,
  onOpenSettings,
  onLogoClick,
}: AppSidebarProps) {
  const pathname = usePathname();
  const activeView = pathToAppView(pathname);
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const sections = buildSections(navCounts);

  function handleNavigate() {
    setMobileOpen(false);
  }

  function isItemActive(item: NavItemConfig): boolean {
    if (item.opensSettings) return false;
    if (item.label === "Analytics") return false;
    if (item.href === appViewToPath("applications") && item.label !== "Applications") return false;
    return pathToAppView(item.href) === activeView && item.label !== "Analytics";
  }

  function navItemClassName(active: boolean) {
    return cn(
      "group flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-xs transition-colors outline-none",
      active
        ? "bg-sidebar-accent text-foreground"
        : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground focus-visible:bg-sidebar-accent focus-visible:text-foreground",
      collapsed && "lg:justify-center lg:px-0",
    );
  }

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "bg-sidebar border-sidebar-border fixed inset-y-0 left-0 z-50 flex h-svh w-64 shrink-0 flex-col border-r transition-[transform,width] duration-200 ease-out",
          "lg:static lg:z-auto lg:translate-x-0",
          collapsed ? "lg:w-16" : "lg:w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-sidebar-border flex h-14 shrink-0 items-stretch border-b">
          <div className="hover:bg-sidebar-accent focus-within:bg-sidebar-accent flex min-h-14 w-full min-w-0 items-stretch transition-colors">
            <button
              type="button"
              onClick={() => {
                onLogoClick();
                handleNavigate();
              }}
              className={cn(
                "text-foreground flex min-h-14 flex-1 cursor-pointer items-center text-base font-bold tracking-tight outline-none select-none",
                collapsed ? "lg:justify-center lg:px-0" : "justify-start pl-4.5",
              )}
              aria-label="Clear filters and go to applications"
            >
              {collapsed ? <span className="hidden lg:inline">A</span> : null}
              <span className={cn(collapsed && "lg:hidden")}>APPLIED.</span>
            </button>
            <button
              type="button"
              onClick={toggleCollapsed}
              className={cn(
                "text-muted-foreground hover:text-foreground hidden w-10 shrink-0 cursor-pointer items-center justify-center self-stretch outline-none lg:flex",
                collapsed && "lg:hidden",
              )}
              aria-label="Collapse sidebar"
              title="Collapse Sidebar"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </div>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto p-2">
          {sections.map((section) => (
            <div key={section.heading} className="mb-3 last:mb-0">
              <p
                className={cn(
                  "text-muted-foreground/70 px-2.5 pt-2 pb-1 text-[0.65rem] font-semibold tracking-widest uppercase",
                  collapsed && "lg:hidden",
                )}
              >
                {section.heading}
              </p>
              {collapsed ? <div className="bg-sidebar-border mx-2 mb-1 hidden h-px lg:block" /> : null}
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isItemActive(item);
                  const className = navItemClassName(active);

                  if (item.opensSettings) {
                    return (
                      <li key={item.label}>
                        <button
                          type="button"
                          title={collapsed ? item.label : undefined}
                          className={className}
                          onClick={() => {
                            handleNavigate();
                            onOpenSettings(item.opensSettings);
                          }}
                        >
                          <Icon className="size-4 shrink-0" />
                          <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>{item.label}</span>
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={item.label}>
                      <Link
                        href={item.href}
                        onClick={handleNavigate}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn("link-plain", className)}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>{item.label}</span>
                        {item.count != null ? (
                          <span
                            className={cn(
                              "text-muted-foreground rounded px-1.5 py-0.5 text-[0.65rem] tabular-nums",
                              active ? "bg-background/60" : "bg-sidebar-accent group-hover:bg-background/60",
                              collapsed && "lg:hidden",
                            )}
                          >
                            {item.count}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-sidebar-border shrink-0 border-t p-2">
          <ProfileMenu
            name={PLACEHOLDER_USER.name}
            email={PLACEHOLDER_USER.email}
            collapsed={collapsed}
            uiShellMode={uiShellMode}
            onToggleUiShellMode={onToggleUiShellMode}
            onLogout={onLogout}
          />
        </div>
      </aside>
    </>
  );
}
