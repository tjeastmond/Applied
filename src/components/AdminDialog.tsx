"use client";

import { useCallback, useEffect, useState } from "react";
import {
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
import { Separator } from "@/components/ui/separator";
import { errorMessage } from "@/lib/errorMessage";
import { FILTER_CONTROL_HEIGHT_CLASS } from "@/lib/filterControls";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { AgentApiTokenSummary, JobApplication } from "@/types";
import {
  CloudUploadIcon,
  CopyIcon,
  DownloadIcon,
  PencilIcon,
  SettingsIcon,
  Trash2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

type AdminDialogProps = {
  applications: JobApplication[];
  onImported: (applications: JobApplication[]) => void;
  tursoSyncAvailable?: boolean;
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

export function AdminDialog({ applications, onImported, tursoSyncAvailable = false }: AdminDialogProps) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncingTurso, setSyncingTurso] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const [tokens, setTokens] = useState<AgentApiTokenSummary[]>([]);
  const [envTokenConfigured, setEnvTokenConfigured] = useState(false);
  const [envTokenRegistered, setEnvTokenRegistered] = useState(false);
  const [tokensLoading, setTokensLoading] = useState(false);
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

  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const result = await listAgentTokens();
      setTokens(result.tokens);
      setEnvTokenConfigured(result.envTokenConfigured);
      setEnvTokenRegistered(result.envTokenRegistered);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.agentTokensLoadFailed));
    } finally {
      setTokensLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      setRevealedToken(null);
      setTokenName("");
      setRenameTargetId(null);
      setRenameValue("");
      return;
    }

    void loadTokens();
  }, [loadTokens, open]);

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
    if (!trimmedName) {
      return;
    }

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
    if (!trimmedName) {
      return;
    }

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

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="header-toolbar-outline"
              disabled={backupBusy}
              aria-label="Admin"
              title="Admin"
            >
              <SettingsIcon />
            </Button>
          }
        />
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <div className="p-4">
            <DialogHeader className="p-0">
              <DialogTitle>Admin</DialogTitle>
              <DialogDescription>Export backups, copy job URLs, and manage agent API tokens.</DialogDescription>
            </DialogHeader>
          </div>

          <Separator />

          <div className="space-y-3 p-4">
            <section className="space-y-3">
              <h2 className="text-sm font-medium">Backup &amp; Export</h2>
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-0.5">
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
            </section>
          </div>

          <Separator />

          <div className="space-y-3 p-4">
            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium">Copy All URLs</h2>
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
            </section>
          </div>

          <Separator />

          <div className="space-y-3 p-4">
            <section className="space-y-3">
              <div className="space-y-1">
                <h2 className="text-sm font-medium">Agent API Tokens</h2>
                <p className="text-muted-foreground text-xs">
                  Create named bearer tokens for external agent tools. Tokens are shown once at creation.
                </p>
              </div>

              {envTokenConfigured ? (
                <div className="space-y-2 rounded-lg border px-3 py-2 text-xs">
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
                      disabled={importingEnvToken}
                      onClick={() => void handleImportEnvToken()}
                    >
                      {importingEnvToken ? "Registering…" : "Register in Database"}
                    </Button>
                  ) : null}
                </div>
              ) : null}

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
                    disabled={creatingToken || tokenName.trim().length === 0}
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
                    <code className="bg-muted min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">{revealedToken}</code>
                    <Button type="button" variant="outline" size="sm" onClick={() => void handleCopyRevealedToken()}>
                      <CopyIcon data-icon="inline-start" />
                      Copy Token
                    </Button>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
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
            </section>
          </div>
        </DialogContent>
      </Dialog>

      <BackupImportDialog open={importOpen} onOpenChange={setImportOpen} onImported={onImported} />

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
