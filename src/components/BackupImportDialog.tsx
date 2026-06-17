"use client";

import { useRef, useState } from "react";
import { importBackup, type ImportBackupMode } from "@/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { JobApplication } from "@/types";
import { toast } from "sonner";

type BackupImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (applications: JobApplication[]) => void;
};

export function BackupImportDialog({ open, onOpenChange, onImported }: BackupImportDialogProps) {
  const [importMode, setImportMode] = useState<ImportBackupMode>("upsert");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetImportState() {
    setSelectedFile(null);
    setImportMode("upsert");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    onOpenChange(nextOpen);
    if (!nextOpen && !isImporting) {
      resetImportState();
    }
  }

  function handleImportClick() {
    if (!selectedFile) return;
    if (importMode === "replace") {
      setConfirmReplaceOpen(true);
      return;
    }
    void runImport();
  }

  async function runImport() {
    if (!selectedFile) return;

    setIsImporting(true);
    try {
      const result = await importBackup(selectedFile, importMode);
      onImported(result.applications);
      setConfirmReplaceOpen(false);
      onOpenChange(false);
      resetImportState();
      toast.success(
        `${toastMessages.backupImported} ${result.imported.applications} application(s), ${result.imported.notes} note(s).`,
      );
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.backupImportFailed));
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Backup</DialogTitle>
            <DialogDescription>Restore from a previously exported SQL or JSON backup file.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="backup-file">Backup File</Label>
              <input
                ref={fileInputRef}
                id="backup-file"
                type="file"
                accept=".sql,.json,application/sql,application/json"
                className="border-input bg-background file:text-foreground hover:file:bg-muted block w-full rounded-lg border px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-transparent file:px-0 file:text-sm file:font-medium"
                onChange={(event) => {
                  setSelectedFile(event.target.files?.[0] ?? null);
                }}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Import Mode</legend>
              <div className="space-y-2">
                <label
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                    importMode === "upsert" ? "border-primary bg-primary/5" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value="upsert"
                    checked={importMode === "upsert"}
                    onChange={() => setImportMode("upsert")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Merge (Upsert)</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      Add or update records by ID without removing existing data.
                    </span>
                  </span>
                </label>
                <label
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition-colors",
                    importMode === "replace" ? "border-destructive bg-destructive/5" : "border-border",
                  )}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value="replace"
                    checked={importMode === "replace"}
                    onChange={() => setImportMode("replace")}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">Replace All</span>
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      Clear the current database and restore only what is in the backup.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
          </div>

          <DialogFooter className="gap-3">
            <Button
              type="button"
              variant="cancelOutline"
              onClick={() => handleOpenChange(false)}
              disabled={isImporting}
            >
              Cancel
            </Button>
            <Button type="button" variant="save" disabled={!selectedFile || isImporting} onClick={handleImportClick}>
              {isImporting ? "Importing…" : "Import Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove all current applications and notes, then restore from the selected backup.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isImporting}>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructiveSolid" disabled={isImporting} onClick={() => void runImport()}>
              {isImporting ? "Importing…" : "Replace and Import"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
