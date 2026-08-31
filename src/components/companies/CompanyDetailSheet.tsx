"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatDate } from "@/lib/applicationForm";
import { statusLabel, statusTagClassName, type ApplicationStatus } from "@/lib/applicationStatus";
import { listApplicationsForCompany } from "@/lib/companies";
import { errorMessage } from "@/lib/errorMessage";
import { isModKeyChord, modSShortcutDescription } from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { Company, JobApplication, PatchCompanyInput } from "@/types";
import { BanIcon, Building2Icon } from "lucide-react";
import { toast } from "sonner";

type CompanyFormState = {
  name: string;
  url: string;
  linkedinUrl: string;
  email: string;
};

type CompanyDetailSheetProps = {
  company: Company | null;
  applications: JobApplication[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompanyChange: (company: Company) => void;
  onToggleIgnored: (id: string, ignored: boolean) => void;
  onUpdateCompany: (id: string, input: PatchCompanyInput) => Promise<Company>;
  onOpenApplication?: (id: string) => void;
};

function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        statusTagClassName(status),
      )}
    >
      {statusLabel(status)}
    </span>
  );
}

function companyToFormState(company: Company): CompanyFormState {
  return {
    name: company.name,
    url: company.url ?? "",
    linkedinUrl: company.linkedinUrl ?? "",
    email: company.email ?? "",
  };
}

function buildPatchInput(current: CompanyFormState, baseline: CompanyFormState): PatchCompanyInput | null {
  const patch: PatchCompanyInput = {};
  const trimmedName = current.name.trim();
  const trimmedUrl = current.url.trim();
  const trimmedLinkedIn = current.linkedinUrl.trim();
  const trimmedEmail = current.email.trim();

  if (trimmedName !== baseline.name.trim()) {
    patch.name = trimmedName;
  }
  if (trimmedUrl !== baseline.url.trim()) {
    patch.url = trimmedUrl;
  }
  if (trimmedLinkedIn !== baseline.linkedinUrl.trim()) {
    patch.linkedinUrl = trimmedLinkedIn;
  }
  if (trimmedEmail !== baseline.email.trim()) {
    patch.email = trimmedEmail;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function CompanyDetailSheet({
  company,
  applications,
  open,
  onOpenChange,
  onCompanyChange,
  onToggleIgnored,
  onUpdateCompany,
  onOpenApplication,
}: CompanyDetailSheetProps) {
  const [form, setForm] = useState<CompanyFormState>({ name: "", url: "", linkedinUrl: "", email: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [unsavedCloseDialogOpen, setUnsavedCloseDialogOpen] = useState(false);
  const baselineRef = useRef<CompanyFormState>({ name: "", url: "", linkedinUrl: "", email: "" });
  const sheetContentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!company) {
      setForm({ name: "", url: "", linkedinUrl: "", email: "" });
      baselineRef.current = { name: "", url: "", linkedinUrl: "", email: "" };
      return;
    }

    const next = companyToFormState(company);
    setForm(next);
    baselineRef.current = next;
  }, [company]);

  const isDirty = buildPatchInput(form, baselineRef.current) !== null;
  const linkedApplications = useMemo(
    () => (company ? listApplicationsForCompany(applications, company.name) : []),
    [applications, company],
  );

  const handleSave = useCallback(async () => {
    if (!company) return;

    if (!form.name.trim()) {
      toast.error(toastMessages.companyNameRequired);
      return;
    }

    const patch = buildPatchInput(form, baselineRef.current);
    if (!patch) {
      toast.info(toastMessages.noChanges);
      return;
    }

    setIsSaving(true);
    try {
      const updated = await onUpdateCompany(company.id, patch);
      onCompanyChange(updated);
      const next = companyToFormState(updated);
      baselineRef.current = next;
      setForm(next);
      toast.success(toastMessages.companyUpdated);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.companyUpdateFailed));
    } finally {
      setIsSaving(false);
    }
  }, [company, form, onCompanyChange, onUpdateCompany]);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setUnsavedCloseDialogOpen(true);
      return;
    }
    onOpenChange(false);
  }, [isDirty, onOpenChange]);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (isModKeyChord(event, "s")) {
        event.preventDefault();
        void handleSave();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, open]);

  if (!company) {
    return null;
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : requestClose())}>
        <SheetContent
          ref={sheetContentRef}
          side="right"
          className="flex w-[60vw] max-w-none flex-col gap-0 p-0 sm:max-w-none"
          initialFocus={sheetContentRef}
        >
          <SheetHeader className="border-border shrink-0 border-b px-6 py-4">
            <SheetTitle className="flex items-center gap-2 text-left">
              <Building2Icon className="size-4 shrink-0" />
              <span className="truncate">{company.name}</span>
            </SheetTitle>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Company Name</Label>
                <Input
                  id="company-name"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  aria-invalid={form.name.trim().length === 0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-url">URL</Label>
                <Input
                  id="company-url"
                  type="url"
                  value={form.url}
                  onChange={(event) => setForm((current) => ({ ...current, url: event.target.value }))}
                  placeholder="https://example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-linkedin">LinkedIn</Label>
                <Input
                  id="company-linkedin"
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(event) => setForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
                  placeholder="https://linkedin.com/company/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-email">Email</Label>
                <Input
                  id="company-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="contact@example.com"
                />
              </div>
              <Separator />
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  Linked Applications
                  <span className="text-muted-foreground font-normal"> ({linkedApplications.length})</span>
                </p>
                {linkedApplications.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No linked applications yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {linkedApplications.map((application) => {
                      const title = application.title?.trim() || application.url;
                      const content = (
                        <>
                          <span className="min-w-0 flex-1 truncate text-left font-medium">{title}</span>
                          <ApplicationStatusBadge status={application.status} />
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {formatDate(application.appliedAt)}
                          </span>
                          {application.archived ? (
                            <span className="text-muted-foreground shrink-0 text-xs">Archived</span>
                          ) : null}
                        </>
                      );

                      if (onOpenApplication) {
                        return (
                          <li key={application.id}>
                            <button
                              type="button"
                              className="hover:bg-muted/60 flex w-full items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors"
                              onClick={() => onOpenApplication(application.id)}
                            >
                              {content}
                            </button>
                          </li>
                        );
                      }

                      return (
                        <li
                          key={application.id}
                          className="bg-muted/40 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm"
                        >
                          {content}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Ignore Company</p>
                <p className="text-muted-foreground text-xs">Ignored companies appear in the Ignored Companies view.</p>
                <Button
                  type="button"
                  variant="outline"
                  className={cn("w-fit", company.ignored && "border-destructive/50 text-destructive")}
                  onClick={() => onToggleIgnored(company.id, !company.ignored)}
                >
                  <BanIcon className="size-4" />
                  {company.ignored ? "Remove From Ignore List" : "Ignore Company"}
                </Button>
              </div>
            </div>
          </div>

          <SheetFooter className="border-border shrink-0 border-t px-6 py-4">
            <div className="flex w-full items-center justify-end gap-2">
              <Button type="button" variant="cancelOutline" onClick={requestClose}>
                Cancel
              </Button>
              <Button type="button" variant="save" disabled={isSaving} onClick={() => void handleSave()}>
                Save Company
              </Button>
            </div>
            <p className="text-muted-foreground mt-2 w-full text-right text-xs">{modSShortcutDescription()}</p>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={unsavedCloseDialogOpen} onOpenChange={setUnsavedCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved company changes. Save before closing?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="cancelOutline"
              onClick={() => {
                setUnsavedCloseDialogOpen(false);
                onOpenChange(false);
              }}
            >
              Don&apos;t Save
            </AlertDialogAction>
            <AlertDialogAction
              variant="save"
              onClick={() => {
                setUnsavedCloseDialogOpen(false);
                void handleSave().then(() => onOpenChange(false));
              }}
            >
              Save Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
