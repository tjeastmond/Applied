"use client";

import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import { MoonIcon, SunIcon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="header-toolbar-outline"
      onClick={toggleTheme}
      aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
      title={isLight ? "Dark Mode" : "Light Mode"}
    >
      {isLight ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
}
