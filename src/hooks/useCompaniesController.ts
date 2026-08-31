"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createCompany, listCompanies, patchCompany, setCompanyIgnored } from "@/api";
import { companyViewModeFromPath, filterCompanies, sortCompanies, type CompanyViewMode } from "@/lib/companies";
import { errorMessage } from "@/lib/errorMessage";
import { toastMessages } from "@/lib/toastMessages";
import type { Company, CreateCompanyInput, JobApplication, PatchCompanyInput } from "@/types";
import { toast } from "sonner";

type UseCompaniesControllerOptions = {
  initialCompanies: Company[];
  applications: JobApplication[];
  routeViewMode: CompanyViewMode;
};

type NewCompanyFormState = {
  name: string;
  url: string;
  linkedinUrl: string;
  email: string;
};

const emptyNewCompanyForm = (): NewCompanyFormState => ({
  name: "",
  url: "",
  linkedinUrl: "",
  email: "",
});

export function useCompaniesController({
  initialCompanies,
  applications,
  routeViewMode,
}: UseCompaniesControllerOptions) {
  const [companies, setCompanies] = useState(initialCompanies);
  const [searchQuery, setSearchQuery] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newCompanyForm, setNewCompanyForm] = useState<NewCompanyFormState>(emptyNewCompanyForm);
  const [isCreating, setIsCreating] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setCompanies(initialCompanies);
  }, [initialCompanies]);

  const sortedCompanies = useMemo(() => sortCompanies(companies), [companies]);
  const visibleCompanies = useMemo(
    () => filterCompanies(sortedCompanies, searchQuery, routeViewMode),
    [sortedCompanies, searchQuery, routeViewMode],
  );
  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) ?? null,
    [companies, selectedCompanyId],
  );
  const hasActiveFilters = searchQuery.trim().length > 0;

  const handleOpenCompany = useCallback((id: string) => {
    setSelectedCompanyId(id);
    setDetailOpen(true);
  }, []);

  const handleCompanyChange = useCallback((company: Company) => {
    setCompanies((current) => current.map((item) => (item.id === company.id ? company : item)));
  }, []);

  const handleToggleIgnored = useCallback(async (id: string, ignored: boolean) => {
    try {
      const updated = await setCompanyIgnored(id, ignored);
      setCompanies((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(ignored ? toastMessages.companyIgnored : toastMessages.companyUnignored);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.companyIgnoreFailed));
    }
  }, []);

  const handleCreateCompany = useCallback(async () => {
    const name = newCompanyForm.name.trim();
    if (!name) {
      toast.error(toastMessages.companyNameRequired);
      return;
    }

    const input: CreateCompanyInput = { name };
    const url = newCompanyForm.url.trim();
    const linkedinUrl = newCompanyForm.linkedinUrl.trim();
    const email = newCompanyForm.email.trim();
    if (url) input.url = url;
    if (linkedinUrl) input.linkedinUrl = linkedinUrl;
    if (email) input.email = email;

    setIsCreating(true);
    try {
      const created = await createCompany(input);
      setCompanies((current) => sortCompanies([...current, created]));
      setNewCompanyForm(emptyNewCompanyForm());
      setAddDialogOpen(false);
      toast.success(toastMessages.companyCreated);
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.companyCreateFailed));
    } finally {
      setIsCreating(false);
    }
  }, [newCompanyForm]);

  const handleUpdateCompany = useCallback(async (id: string, input: PatchCompanyInput) => {
    const updated = await patchCompany(id, input);
    setCompanies((current) => sortCompanies(current.map((item) => (item.id === updated.id ? updated : item))));
    return updated;
  }, []);

  const clearFilters = useCallback(() => {
    setSearchQuery("");
  }, []);

  const refreshCompanies = useCallback(async () => {
    try {
      const next = await listCompanies();
      setCompanies(sortCompanies(next));
    } catch (error) {
      toast.error(errorMessage(error, toastMessages.companiesLoadFailed));
    }
  }, []);

  return {
    companies,
    applications,
    visibleCompanies,
    selectedCompany,
    detailOpen,
    addDialogOpen,
    newCompanyForm,
    isCreating,
    searchQuery,
    hasActiveFilters,
    searchInputRef,
    setSearchQuery,
    setDetailOpen,
    setAddDialogOpen,
    setNewCompanyForm,
    handleOpenCompany,
    handleCompanyChange,
    handleToggleIgnored,
    handleCreateCompany,
    handleUpdateCompany,
    clearFilters,
    refreshCompanies,
    routeViewMode,
  };
}

export type CompaniesController = ReturnType<typeof useCompaniesController>;

export function resolveCompaniesRouteViewMode(pathname: string): CompanyViewMode {
  return companyViewModeFromPath(pathname);
}
