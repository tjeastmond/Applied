"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApplicationCard } from "@/components/ApplicationCard";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { AuthenticatedAppController } from "@/hooks/useAuthenticatedAppController";
import type { CompaniesController } from "@/hooks/useCompaniesController";
import { COMPANIES_PATH, deriveCompanyContacts, listApplicationsForCompany } from "@/lib/companies";
import { errorMessage } from "@/lib/errorMessage";
import { isModKeyChord, modSShortcutDescription } from "@/lib/keyboardShortcut";
import { toastMessages } from "@/lib/toastMessages";
import { cn } from "@/lib/utils";
import type { Company, PatchCompanyInput } from "@/types";
import { BanIcon, Building2Icon, ChevronLeftIcon } from "lucide-react";
import { toast } from "sonner";

type CompanyFormState = {
  name: string;
  url: string;
  linkedinUrl: string;
  email: string;
};

const EMPTY_FORM: CompanyFormState = { name: "", url: "", linkedinUrl: "", email: "" };

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

  if (trimmedName !== baseline.name.trim()) patch.name = trimmedName;
  if (trimmedUrl !== baseline.url.trim()) patch.url = trimmedUrl;
  if (trimmedLinkedIn !== baseline.linkedinUrl.trim()) patch.linkedinUrl = trimmedLinkedIn;
  if (trimmedEmail !== baseline.email.trim()) patch.email = trimmedEmail;

  return Object.keys(patch).length > 0 ? patch : null;
}

const COMPANY_JOB_GRID_CLASSES = "grid grid-cols-1 gap-4 lg:grid-cols-2";

type CompanyPageProps = Pick<CompaniesController, "companies" | "handleCompanyChange" | "handleUpdateCompany"> &
  Pick<
    AuthenticatedAppController,
    "applications" | "handleOpenApplication" | "handlePrefetchNotes" | "handleStatusChange" | "handlePinChange"
  > & {
    companyId: string;
    handleToggleIgnored: (id: string, ignored: boolean) => void | Promise<void>;
    edgeBleedClassName?: string;
  };

export function CompanyPage({
  companyId,
  companies,
  applications,
  handleCompanyChange,
  handleUpdateCompany,
  handleToggleIgnored,
  handleOpenApplication,
  handlePrefetchNotes,
  handleStatusChange,
  handlePinChange,
  edgeBleedClassName,
}: CompanyPageProps) {
  const router = useRouter();
  const company = useMemo(() => companies.find((item) => item.id === companyId) ?? null, [companies, companyId]);
  const [form, setForm] = useState<CompanyFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [unsavedDialogOpen, setUnsavedDialogOpen] = useState(false);
  const baselineRef = useRef<CompanyFormState>(EMPTY_FORM);

  useEffect(() => {
    const next = company ? companyToFormState(company) : EMPTY_FORM;
    setForm(next);
    baselineRef.current = next;
  }, [company]);

  const isDirty = company !== null && buildPatchInput(form, baselineRef.current) !== null;
  const companyApplications = useMemo(
    () => (company ? listApplicationsForCompany(applications, company.name) : []),
    [applications, company],
  );
  const contacts = useMemo(() => deriveCompanyContacts(companyApplications), [companyApplications]);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!company) return false;

    if (!form.name.trim()) {
      toast.error(toastMessages.companyNameRequired);
      return false;
    }

    const patch = buildPatchInput(form, baselineRef.current);
    if (!patch) {
      toast.info(toastMessages.noChanges);
      return true;
    }

    setIsSaving(true);
    try {
      const updated = await handleUpdateCompany(company.id, patch);
      handleCompanyChange(updated);
      const next = companyToFormState(updated);
      baselineRef.current = next;
      setForm(next);
      toast.success(toastMessages.companyUpdated);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.companyUpdateFailed));
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [company, form, handleCompanyChange, handleUpdateCompany]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (isModKeyChord(event, "s")) {
        event.preventDefault();
        void handleSave();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  useEffect(() => {
    if (!isDirty) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const handleBackClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (!isDirty) return;
      event.preventDefault();
      setUnsavedDialogOpen(true);
    },
    [isDirty],
  );

  const backLink = (
    <Link
      href={COMPANIES_PATH}
      onClick={handleBackClick}
      className="link-plain text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
    >
      <ChevronLeftIcon className="size-4" />
      Companies
    </Link>
  );

  if (!company) {
    return (
      <div className="mx-auto flex w-full max-w-none flex-col gap-4">
        {backLink}
        <Card className="shadow-sm shadow-black/5">
          <CardContent className="py-10 text-center">
            <p className="font-medium">Company not found</p>
            <p className="text-muted-foreground mt-1 text-sm">
              This company may have been removed.{" "}
              <Link href={COMPANIES_PATH} className="text-blue-600 dark:text-blue-400">
                Back to Companies
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-4">
      {backLink}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Building2Icon className="size-5 shrink-0" />
          <h1 className="truncate text-xl font-semibold">{company.name}</h1>
        </div>
        <Button
          type="button"
          variant="outline"
          className={cn("shrink-0", company.ignored && "border-destructive/50 text-destructive")}
          onClick={() => void handleToggleIgnored(company.id, !company.ignored)}
        >
          <BanIcon className="size-4" />
          {company.ignored ? "Remove From Ignore List" : "Ignore Company"}
        </Button>
      </div>

      <div className={cn("py-1", edgeBleedClassName)}>
        <Separator />
      </div>

      <section className="space-y-4" aria-labelledby="company-details-heading">
        <h2 id="company-details-heading" className="text-sm font-medium">
          Company Details
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
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
        </div>
        <div className="flex items-center justify-end gap-3">
          <p className="text-muted-foreground text-xs">{modSShortcutDescription("company")}</p>
          <Button type="button" variant="save" disabled={isSaving} onClick={() => void handleSave()}>
            Save Company
          </Button>
        </div>
      </section>

      <div className={cn("py-1", edgeBleedClassName)}>
        <Separator />
      </div>

      <section className="space-y-3" aria-labelledby="company-contacts-heading">
        <h2 id="company-contacts-heading" className="text-sm font-medium">
          Contacts
          <span className="text-muted-foreground font-normal"> ({contacts.length})</span>
        </h2>
        {contacts.length === 0 ? (
          <p className="text-muted-foreground text-sm">No contacts yet.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {contacts.map((contact, index) => (
              <li key={`${contact.email ?? contact.name ?? "contact"}-${index}`}>
                <Card size="sm" className="h-full shadow-sm shadow-black/5">
                  <CardHeader>
                    <CardTitle className="truncate text-sm">
                      {contact.name ?? contact.email ?? "Unnamed Contact"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {contact.firm ? <p className="text-muted-foreground">{contact.firm}</p> : null}
                    {contact.email ? (
                      <p>
                        <a href={`mailto:${contact.email}`} className="text-blue-600 dark:text-blue-400">
                          {contact.email}
                        </a>
                      </p>
                    ) : null}
                    {contact.phone ? (
                      <p>
                        <a href={`tel:${contact.phone}`} className="text-blue-600 dark:text-blue-400">
                          {contact.phone}
                        </a>
                      </p>
                    ) : null}
                    <p className="text-muted-foreground">From: {contact.sourceTitles.join(", ")}</p>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={cn("py-1", edgeBleedClassName)}>
        <Separator />
      </div>

      <section className="space-y-3" aria-labelledby="company-jobs-heading">
        <h2 id="company-jobs-heading" className="text-sm font-medium">
          Jobs
          <span className="text-muted-foreground font-normal"> ({companyApplications.length})</span>
        </h2>
        {companyApplications.length === 0 ? (
          <p className="text-muted-foreground text-sm">No applications for this company yet.</p>
        ) : (
          <div className={COMPANY_JOB_GRID_CLASSES}>
            {companyApplications.map((application) => (
              <div key={application.id} className="relative min-w-0">
                <ApplicationCard
                  application={application}
                  onOpen={handleOpenApplication}
                  onPrefetchNotes={handlePrefetchNotes}
                  onStatusChange={handleStatusChange}
                  onPinChange={handlePinChange}
                />
                {application.archived ? (
                  <span className="text-muted-foreground bg-muted pointer-events-none absolute right-3 bottom-2 rounded-md px-2 py-0.5 text-xs">
                    Archived
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <AlertDialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>You have unsaved company changes. Save before leaving?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              variant="cancelOutline"
              onClick={() => {
                setUnsavedDialogOpen(false);
                const next = company ? companyToFormState(company) : EMPTY_FORM;
                baselineRef.current = next;
                setForm(next);
                router.push(COMPANIES_PATH);
              }}
            >
              Don&apos;t Save
            </AlertDialogAction>
            <AlertDialogAction
              variant="save"
              onClick={() => {
                setUnsavedDialogOpen(false);
                void handleSave().then((saved) => {
                  if (saved) router.push(COMPANIES_PATH);
                });
              }}
            >
              Save Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
