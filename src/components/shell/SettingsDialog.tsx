"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import {
  bulkArchiveApplications,
  createAgentToken,
  downloadDatabaseBackup,
  exportBackup,
  importAgentTokenFromEnv,
  listAgentTokens,
  renameAgentToken,
  revokeAgentToken,
  syncTurso,
} from "@/api";
import { BackupImportDialog } from "@/components/BackupImportDialog";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UiShellMode } from "@/hooks/useUiShellMode";
import { MAX_ACTIVE_AGENT_API_TOKENS } from "@/lib/agentTokenLimits";
import {
  bulkArchiveConfirmDescription,
  bulkArchiveConfirmTitle,
  countArchivableApplications,
} from "@/lib/applicationArchive";
import { FILTER_CONTROL_HEIGHT_CLASS } from "@/lib/filterControls";
import { errorMessage } from "@/lib/errorMessage";
import {
  appKeyboardShortcuts,
  isAdminBulkArchiveShortcut,
  isAdminOpenShortcut,
  isEditableKeyboardTarget,
} from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { AgentApiTokenSummary, JobApplication } from "@/types";
import {
  ArchiveIcon,
  Bot,
  CloudUploadIcon,
  CopyIcon,
  DownloadIcon,
  Keyboard,
  LayoutTemplate,
  Monitor,
  PencilIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

export type SettingsSection = "general" | "data" | "archive" | "agent" | "shortcuts";

const SECTIONS: { id: SettingsSection; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "general", label: "General", icon: Monitor },
  { id: "data", label: "Data", icon: DownloadIcon },
  { id: "archive", label: "Archive", icon: ArchiveIcon },
  { id: "agent", label: "Agent", icon: Bot },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
];

export type SettingsDialogProps = {
  applications: JobApplication[];
  onImported: (applications: JobApplication[]) => void;
  onApplicationsUpdated: (applications: JobApplication[]) => void;
  tursoSyncAvailable?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  initialSection?: SettingsSection;
  trigger?: ReactNode;
  uiShellMode?: UiShellMode;
  onToggleUiShellMode?: () => void;
};

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatTokenDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTokenMetadata(token: AgentApiTokenSummary): string {
  const created = `Created ${formatTokenDate(token.createdAt)}`;
  if (token.lastUsedAt) {
    return `${token.tokenPrefix}… · ${created} · Last used ${formatTokenDate(token.lastUsedAt)}`;
  }
  return `${token.tokenPrefix}… · ${created}`;
}

export function SettingsDialog({
  applications,
  onImported,
  onApplicationsUpdated,
  tursoSyncAvailable = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  initialSection = "general",
  trigger,
  uiShellMode,
  onToggleUiShellMode,
}: SettingsDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;

  const [section, setSection] = useState<SettingsSection>(initialSection);
  const [exporting, setExporting] = useState(false);
  const [syncingTurso, setSyncingTurso] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingBulkArchive, setPendingBulkArchive] = useState(false);
  const [isBulkArchiving, setIsBulkArchiving] = useState(false);

  const archivableCount = countArchivableApplications(applications);

  const [tokens, setTokens] = useState<AgentApiTokenSummary[]>([]);
  const [envTokenConfigured, setEnvTokenConfigured] = useState(false);
  const [envTokenRegistered, setEnvTokenRegistered] = useState(false);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokenName, setTokenName] = useState("");
  const [creatingToken, setCreatingToken] = useState(false);
  const [importingEnvToken, setImportingEnvToken] = useState(false);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<AgentApiTokenSummary | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const backupBusy = exporting || syncingTurso;
  const atTokenLimit = tokens.length >= MAX_ACTIVE_AGENT_API_TOKENS;
  const hasLoadedTokensRef = useRef(false);

  const loadTokens = useCallback(async ({ showLoading = !hasLoadedTokensRef.current } = {}) => {
    if (showLoading) {
      setTokensLoading(true);
    }

    try {
      const result = await listAgentTokens();
      setTokens(result.tokens);
      setEnvTokenConfigured(result.envTokenConfigured);
      setEnvTokenRegistered(result.envTokenRegistered);
      hasLoadedTokensRef.current = true;
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokensLoadFailed));
    } finally {
      if (showLoading) {
        setTokensLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadTokens();
  }, [loadTokens]);

  useEffect(() => {
    if (!open) {
      setRevealedToken(null);
      setTokenName("");
      setRenameTargetId(null);
      setRenameValue("");
      return;
    }

    setSection(initialSection);
    void loadTokens({ showLoading: false });
  }, [initialSection, loadTokens, open]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!isAdminOpenShortcut(event)) return;
      if (isEditableKeyboardTarget(event.target)) return;
      event.preventDefault();
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  async function handleExport(format: "sql" | "json") {
    setExporting(true);
    try {
      const { blob, filename } = await exportBackup(format);
      downloadBlob(blob, filename);
      toast.success(toastMessages.backupExported);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.backupExportFailed));
    } finally {
      setExporting(false);
    }
  }

  async function handleDownloadDatabaseBackup() {
    setExporting(true);
    try {
      const { blob, filename } = await downloadDatabaseBackup();
      downloadBlob(blob, filename);
      toast.success(toastMessages.backupExported);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.backupExportFailed));
    } finally {
      setExporting(false);
    }
  }

  async function handleTursoSync() {
    setSyncingTurso(true);
    try {
      const result = await syncTurso();
      const detail = `${result.imported.applications} application(s), ${result.imported.notes} note(s).`;
      if (result.matches) {
        toast.success(`${toastMessages.tursoSyncSuccess} ${detail}`);
        return;
      }

      toast.success(`${toastMessages.tursoSyncPartial} ${detail}`);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.tursoSyncFailed));
    } finally {
      setSyncingTurso(false);
    }
  }

  async function handleImportEnvToken() {
    const trimmedName = tokenName.trim() || "Environment";
    setImportingEnvToken(true);
    try {
      const imported = await importAgentTokenFromEnv(trimmedName);
      setTokens((current) => [imported.record, ...current]);
      setEnvTokenRegistered(true);
      toast.success(toastMessages.agentTokenImported);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokenImportFailed));
    } finally {
      setImportingEnvToken(false);
    }
  }

  function startRename(token: AgentApiTokenSummary) {
    setRenameTargetId(token.id);
    setRenameValue(token.name);
  }

  function cancelRename() {
    setRenameTargetId(null);
    setRenameValue("");
  }

  async function handleSaveRename(tokenId: string) {
    const trimmedName = renameValue.trim();
    if (!trimmedName) return;

    setRenaming(true);
    try {
      const updated = await renameAgentToken(tokenId, trimmedName);
      setTokens((current) => current.map((token) => (token.id === tokenId ? updated : token)));
      cancelRename();
      toast.success(toastMessages.agentTokenRenamed);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokenRenameFailed));
    } finally {
      setRenaming(false);
    }
  }

  async function handleCreateToken() {
    const trimmedName = tokenName.trim();
    if (!trimmedName) return;

    setCreatingToken(true);
    try {
      const created = await createAgentToken(trimmedName);
      setRevealedToken(created.token);
      setTokenName("");
      setTokens((current) => [created.record, ...current]);
      toast.success(toastMessages.agentTokenCreated);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokenCreateFailed));
    } finally {
      setCreatingToken(false);
    }
  }

  async function handleCopyRevealedToken() {
    if (!revealedToken) return;

    try {
      await navigator.clipboard.writeText(revealedToken);
      toast.success(toastMessages.agentTokenCopied);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokenCopyFailed));
    }
  }

  async function handleCopyAllUrls() {
    const urls = applications.map((application) => application.url.trim()).filter(Boolean);
    if (urls.length === 0) return;

    try {
      await navigator.clipboard.writeText(urls.join("\n"));
      toast.success(toastMessages.allJobUrlsCopied);
    } catch {
      toast.error(toastMessages.allJobUrlsCopyFailed);
    }
  }

  const handleConfirmBulkArchive = useCallback(async () => {
    setIsBulkArchiving(true);
    try {
      const result = await bulkArchiveApplications();
      onApplicationsUpdated(result.applications);
      if (result.archivedCount === 0) {
        toast.info(toastMessages.bulkArchiveNothing);
      } else {
        toast.success(toastMessages.bulkArchiveSuccess(result.archivedCount));
      }
      setPendingBulkArchive(false);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.bulkArchiveFailed));
    } finally {
      setIsBulkArchiving(false);
    }
  }, [onApplicationsUpdated]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (!isAdminBulkArchiveShortcut(event)) return;
      if (isEditableKeyboardTarget(event.target)) return;
      if (archivableCount === 0 || isBulkArchiving) return;
      event.preventDefault();
      void handleConfirmBulkArchive();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, archivableCount, isBulkArchiving, handleConfirmBulkArchive]);

  async function handleConfirmRevoke() {
    if (!revokeTarget) return;

    setRevoking(true);
    try {
      await revokeAgentToken(revokeTarget.id);
      setTokens((current) => current.filter((token) => token.id !== revokeTarget.id));
      setRevokeTarget(null);
      toast.success(toastMessages.agentTokenRevoked);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokenRevokeFailed));
    } finally {
      setRevoking(false);
    }
  }

  const shortcuts = appKeyboardShortcuts();

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger ? <DialogTrigger render={trigger as ReactElement} /> : null}
        <DialogContent className="flex h-[min(32rem,90vh)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(46rem,92vw)]">
          <div className="border-border shrink-0 border-b px-5 py-4">
            <DialogHeader className="p-0">
              <DialogTitle>Settings</DialogTitle>
              <DialogDescription>Manage your workspace preferences.</DialogDescription>
            </DialogHeader>
          </div>

          <div className="flex min-h-0 flex-1">
            <nav className="border-border flex w-44 shrink-0 flex-col gap-1 border-r p-2">
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors",
                      active
                        ? "bg-accent text-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </button>
                );
              })}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {section === "general" ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-sm font-medium">Interface</h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                      Choose which layout to use for the application list.
                    </p>
                  </div>
                  {uiShellMode && onToggleUiShellMode ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="header-toolbar-outline w-fit"
                      onClick={onToggleUiShellMode}
                    >
                      <LayoutTemplate data-icon="inline-start" />
                      {uiShellMode === "shell" ? "Switch to Classic UI" : "Switch to New UI"}
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {section === "data" ? (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium">Backup &amp; Export</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("header-toolbar-outline shrink-0", FILTER_CONTROL_HEIGHT_CLASS)}
                        disabled={backupBusy}
                        onClick={() => void handleExport("sql")}
                      >
                        <DownloadIcon data-icon="inline-start" />
                        Export SQL
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("header-toolbar-outline shrink-0", FILTER_CONTROL_HEIGHT_CLASS)}
                        disabled={backupBusy}
                        onClick={() => void handleExport("json")}
                      >
                        <DownloadIcon data-icon="inline-start" />
                        Export JSON
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("header-toolbar-outline shrink-0", FILTER_CONTROL_HEIGHT_CLASS)}
                        disabled={backupBusy}
                        onClick={() => void handleDownloadDatabaseBackup()}
                      >
                        <DownloadIcon data-icon="inline-start" />
                        Create Backup
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn("header-toolbar-outline shrink-0", FILTER_CONTROL_HEIGHT_CLASS)}
                        disabled={backupBusy}
                        onClick={() => setImportOpen(true)}
                      >
                        <UploadIcon data-icon="inline-start" />
                        Import Backup
                      </Button>
                      {tursoSyncAvailable ? (
                        <Button
                          type="button"
                          variant="outline"
                          className={cn("header-toolbar-outline shrink-0", FILTER_CONTROL_HEIGHT_CLASS)}
                          disabled={backupBusy}
                          onClick={() => void handleTursoSync()}
                        >
                          <CloudUploadIcon data-icon="inline-start" />
                          {syncingTurso ? "Turso Sync…" : "Turso Sync"}
                        </Button>
                      ) : null}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <h3 className="text-sm font-medium">Copy All URLs</h3>
                      <p className="text-muted-foreground text-xs">
                        Copy the job posting URLs for every application you&apos;ve applied to.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn("header-toolbar-outline w-fit", FILTER_CONTROL_HEIGHT_CLASS)}
                      disabled={applications.length === 0}
                      onClick={() => void handleCopyAllUrls()}
                    >
                      <CopyIcon data-icon="inline-start" />
                      Copy All URLs
                    </Button>
                  </div>
                </div>
              ) : null}

              {section === "archive" ? (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Bulk Archive</h3>
                    <p className="text-muted-foreground text-xs">
                      Move rejected and passed applications out of the active list.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className={cn("header-toolbar-outline w-fit", FILTER_CONTROL_HEIGHT_CLASS)}
                    disabled={archivableCount === 0}
                    onClick={() => setPendingBulkArchive(true)}
                  >
                    <ArchiveIcon data-icon="inline-start" />
                    Archive
                  </Button>
                </div>
              ) : null}

              {section === "agent" ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium">Agent API Tokens</h3>
                    <p className="text-muted-foreground text-xs">
                      Named bearer tokens for external agent tools (e.g. Cursor, Codex). Shown once at creation. Up to{" "}
                      {MAX_ACTIVE_AGENT_API_TOKENS} active agent tokens — your app login token is separate and does not
                      count toward this limit.
                    </p>
                  </div>

                  {(tokensLoading || envTokenConfigured) && (
                    <div
                      className={cn(
                        "rounded-lg border px-3 py-2 text-xs",
                        tokensLoading ? "min-h-[6.5rem] border-transparent" : "space-y-2",
                      )}
                    >
                      {tokensLoading ? (
                        <span className="sr-only">Loading environment token status…</span>
                      ) : (
                        <>
                          <p className="text-muted-foreground">
                            An environment token is also active
                            {envTokenRegistered
                              ? " and registered in the database."
                              : ". Register it here to manage and revoke it from the UI."}
                            {!envTokenRegistered
                              ? " Remove AGENT_API_TOKEN from the environment when you no longer need both."
                              : null}
                          </p>
                          {!envTokenRegistered ? (
                            <Button
                              type="button"
                              variant="save"
                              size="sm"
                              disabled={importingEnvToken || atTokenLimit}
                              onClick={() => void handleImportEnvToken()}
                            >
                              {importingEnvToken ? "Registering…" : "Register in Database"}
                            </Button>
                          ) : null}
                        </>
                      )}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label htmlFor="agent-token-name">Token Name</Label>
                      <Input
                        id="agent-token-name"
                        value={tokenName}
                        onChange={(event) => setTokenName(event.target.value)}
                        placeholder="e.g. Cursor Agent"
                        className={FILTER_CONTROL_HEIGHT_CLASS}
                        disabled={creatingToken}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleCreateToken();
                          }
                        }}
                      />
                    </div>
                    <div className="flex shrink-0 items-end">
                      <Button
                        type="button"
                        variant="save"
                        className={FILTER_CONTROL_HEIGHT_CLASS}
                        disabled={creatingToken || tokenName.trim().length === 0 || atTokenLimit}
                        onClick={() => void handleCreateToken()}
                      >
                        {creatingToken ? "Creating…" : "Create Token"}
                      </Button>
                    </div>
                  </div>

                  {revealedToken ? (
                    <div className="space-y-2 rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-3">
                      <p className="text-xs font-medium">Copy this token now. It won&apos;t be shown again.</p>
                      <div className="flex items-center gap-2">
                        <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                          {revealedToken}
                        </code>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleCopyRevealedToken()}
                        >
                          <CopyIcon data-icon="inline-start" />
                          Copy Token
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  <div className="min-h-[3.25rem] space-y-2">
                    {tokensLoading ? (
                      <p className="text-muted-foreground text-sm">Loading tokens…</p>
                    ) : tokens.length === 0 ? (
                      <p className="text-muted-foreground text-sm">
                        No agent tokens yet. Create one for external agent tools.
                      </p>
                    ) : (
                      <ul className="divide-border divide-y rounded-lg border">
                        {tokens.map((token) => (
                          <li key={token.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                            <div className="min-w-0 flex-1">
                              {renameTargetId === token.id ? (
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={renameValue}
                                    onChange={(event) => setRenameValue(event.target.value)}
                                    className={FILTER_CONTROL_HEIGHT_CLASS}
                                    disabled={renaming}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        event.preventDefault();
                                        void handleSaveRename(token.id);
                                      }
                                      if (event.key === "Escape") {
                                        event.preventDefault();
                                        cancelRename();
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    variant="save"
                                    size="sm"
                                    disabled={renaming || renameValue.trim().length === 0}
                                    onClick={() => void handleSaveRename(token.id)}
                                  >
                                    {renaming ? "Saving…" : "Save"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="cancelOutline"
                                    size="sm"
                                    disabled={renaming}
                                    onClick={cancelRename}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <p className="truncate font-medium">{token.name}</p>
                                  <p className="text-muted-foreground text-xs">{formatTokenMetadata(token)}</p>
                                </>
                              )}
                            </div>
                            {renameTargetId === token.id ? null : (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground shrink-0"
                                  aria-label={`Rename ${token.name}`}
                                  title="Rename token"
                                  onClick={() => startRename(token)}
                                >
                                  <PencilIcon />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="text-muted-foreground hover:text-destructive shrink-0"
                                  aria-label={`Revoke ${token.name}`}
                                  title="Revoke token"
                                  onClick={() => setRevokeTarget(token)}
                                >
                                  <Trash2Icon />
                                </Button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ) : null}

              {section === "shortcuts" ? (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Keyboard Shortcuts</h3>
                  <ul className="space-y-2">
                    {shortcuts.map((entry) => (
                      <li
                        key={`${entry.context}-${entry.keys}-${entry.description}`}
                        className="flex items-start justify-between gap-4 text-xs"
                      >
                        <span className="text-muted-foreground">{entry.description}</span>
                        <kbd className="bg-muted shrink-0 rounded px-1.5 py-0.5 font-sans text-[0.65rem]">
                          {entry.keys}
                        </kbd>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BackupImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={onImported} />

      <AlertDialog
        open={pendingBulkArchive}
        onOpenChange={(nextOpen) => !nextOpen && !isBulkArchiving && setPendingBulkArchive(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bulkArchiveConfirmTitle()}</AlertDialogTitle>
            <AlertDialogDescription>{bulkArchiveConfirmDescription(archivableCount)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkArchiving} variant="cancelOutline">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isBulkArchiving}
              variant="save"
              onClick={() => void handleConfirmBulkArchive()}
            >
              {isBulkArchiving ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={revokeTarget !== null} onOpenChange={(nextOpen) => !nextOpen && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Agent Token?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget
                ? `Revoke "${revokeTarget.name}"? External agents using this token will lose access${
                    !envTokenConfigured && tokens.length === 1 ? " unless an environment token is configured" : ""
                  }.`
                : "Revoke this agent token?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructiveSolid"
              disabled={revoking}
              onClick={() => void handleConfirmRevoke()}
            >
              {revoking ? "Revoking…" : "Revoke Token"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
