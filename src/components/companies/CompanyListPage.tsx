"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { CompanyCard } from "@/components/companies/CompanyCard";
import { CompanyFilters } from "@/components/companies/CompanyFilters";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { CompaniesController } from "@/hooks/useCompaniesController";
import { companyPath } from "@/lib/companies";
import { PlusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const COMPANY_CARD_GRID_CLASSES = "grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4";

type CompanyListPageProps = Pick<
  CompaniesController,
  | "applications"
  | "visibleCompanies"
  | "addDialogOpen"
  | "newCompanyForm"
  | "isCreating"
  | "searchQuery"
  | "hasActiveFilters"
  | "searchInputRef"
  | "routeViewMode"
  | "setSearchQuery"
  | "setAddDialogOpen"
  | "setNewCompanyForm"
  | "handleToggleIgnored"
  | "handleCreateCompany"
  | "clearFilters"
> & {
  edgeBleedClassName?: string;
};

export function CompanyListPage({
  applications,
  visibleCompanies,
  addDialogOpen,
  newCompanyForm,
  isCreating,
  searchQuery,
  hasActiveFilters,
  searchInputRef,
  routeViewMode,
  setSearchQuery,
  setAddDialogOpen,
  setNewCompanyForm,
  handleToggleIgnored,
  handleCreateCompany,
  clearFilters,
  edgeBleedClassName,
}: CompanyListPageProps) {
  const router = useRouter();
  const handleOpenCompany = useCallback((id: string) => router.push(companyPath(id)), [router]);
  const isIgnoredView = routeViewMode === "ignored";
  const emptyTitle = isIgnoredView ? "No ignored companies" : "No companies yet";
  const emptyDescription = isIgnoredView
    ? "Companies you ignore will appear here."
    : "Add a company manually or save an application with a company name.";

  return (
    <div className="mx-auto flex w-full max-w-none flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{isIgnoredView ? "Ignored Companies" : "Companies"}</h1>
          <p className="text-muted-foreground text-sm">
            {visibleCompanies.length} {visibleCompanies.length === 1 ? "company" : "companies"}
          </p>
        </div>
        <Button type="button" variant="save" onClick={() => setAddDialogOpen(true)}>
          <PlusIcon className="size-4" />
          Add Company
        </Button>
      </div>

      <CompanyFilters
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onClearFilters={clearFilters}
        hasActiveFilters={hasActiveFilters}
        searchInputRef={searchInputRef}
      />

      <div className={cn("py-3", edgeBleedClassName)}>
        <Separator />
      </div>

      {visibleCompanies.length === 0 ? (
        <Card className="shadow-sm shadow-black/5">
          <CardContent className="py-10 text-center">
            <p className="font-medium">{hasActiveFilters ? "No companies match your filters" : emptyTitle}</p>
            <p className="text-muted-foreground mt-1 text-sm">
              {hasActiveFilters ? "Try clearing filters." : emptyDescription}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className={COMPANY_CARD_GRID_CLASSES}>
          {visibleCompanies.map((company) => (
            <CompanyCard
              key={company.id}
              company={company}
              applications={applications}
              onOpen={handleOpenCompany}
              onToggleIgnored={(id, ignored) => {
                void handleToggleIgnored(id, ignored);
              }}
            />
          ))}
        </div>
      )}

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-company-name">Company Name</Label>
              <Input
                id="new-company-name"
                value={newCompanyForm.name}
                onChange={(event) => setNewCompanyForm((current) => ({ ...current, name: event.target.value }))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleCreateCompany();
                  }
                }}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-url">URL</Label>
              <Input
                id="new-company-url"
                type="url"
                value={newCompanyForm.url}
                onChange={(event) => setNewCompanyForm((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-linkedin">LinkedIn</Label>
              <Input
                id="new-company-linkedin"
                type="url"
                value={newCompanyForm.linkedinUrl}
                onChange={(event) => setNewCompanyForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
                placeholder="https://linkedin.com/company/..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-company-email">Email</Label>
              <Input
                id="new-company-email"
                type="email"
                value={newCompanyForm.email}
                onChange={(event) => setNewCompanyForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="contact@example.com"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="cancelOutline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="save" disabled={isCreating} onClick={() => void handleCreateCompany()}>
              Add Company
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
