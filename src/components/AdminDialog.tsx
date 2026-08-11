"use client";

import { Button } from "@/components/ui/button";
import type { SettingsDialogProps } from "@/components/shell/SettingsDialog";
import { SettingsDialog } from "@/components/shell/SettingsDialog";
import { SettingsIcon } from "lucide-react";

type AdminDialogProps = Omit<SettingsDialogProps, "trigger" | "open" | "onOpenChange" | "initialSection">;

export function AdminDialog(props: AdminDialogProps) {
  return (
    <SettingsDialog
      {...props}
      trigger={
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="header-toolbar-outline"
          aria-label="Admin"
          title="Admin"
        >
          <SettingsIcon />
        </Button>
      }
    />
  );
}
