import { describe, expect, it } from "vitest";
import {
  applicationToForm,
  emptyForm,
  formToInput,
  getRequiredValidationState,
  isFormPristine,
  isManualSaveFormDirty,
  isStatusOnlyFormChange,
  isFormValid,
  isProbablyHttpUrl,
  normalizeClipboardOnlyJobUrl,
  normalizePastedJobUrl,
  safeFormToInput,
} from "../src/lib/applicationForm";
import type { JobApplication } from "../src/types";

describe("isProbablyHttpUrl", () => {
  it("accepts http and https URLs", () => {
    expect(isProbablyHttpUrl("https://jobs.example.com/role")).toBe(true);
    expect(isProbablyHttpUrl("http://jobs.example.com")).toBe(true);
  });

  it("rejects non-URLs and non-http schemes", () => {
    expect(isProbablyHttpUrl("not-a-url")).toBe(false);
    expect(isProbablyHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isProbablyHttpUrl("")).toBe(false);
  });
});

describe("normalizePastedJobUrl", () => {
  it("returns https URLs unchanged", () => {
    expect(normalizePastedJobUrl("https://www.ycombinator.com/companies/acme/jobs/abc")).toBe(
      "https://www.ycombinator.com/companies/acme/jobs/abc",
    );
  });

  it("adds https when the pasted text omits a scheme", () => {
    expect(normalizePastedJobUrl("www.ycombinator.com/companies/acme/jobs/abc")).toBe(
      "https://www.ycombinator.com/companies/acme/jobs/abc",
    );
  });

  it("returns null for non-URL text", () => {
    expect(normalizePastedJobUrl("not a url")).toBeNull();
  });
});

describe("normalizeClipboardOnlyJobUrl", () => {
  it("normalizes a single URL from the clipboard", () => {
    expect(normalizeClipboardOnlyJobUrl("https://jobs.example.com/role")).toBe("https://jobs.example.com/role");
    expect(normalizeClipboardOnlyJobUrl("  www.jobs.example.com/role  ")).toBe("https://www.jobs.example.com/role");
  });

  it("returns null when the clipboard has extra lines or non-URL text", () => {
    expect(normalizeClipboardOnlyJobUrl("https://jobs.example.com\nnotes")).toBeNull();
    expect(normalizeClipboardOnlyJobUrl("see https://jobs.example.com")).toBeNull();
    expect(normalizeClipboardOnlyJobUrl("not a url")).toBeNull();
  });
});

describe("isFormValid", () => {
  it("requires url, title, company, and appliedAt", () => {
    expect(isFormValid(emptyForm())).toBe(false);

    const valid = emptyForm();
    valid.url = "https://jobs.example.com";
    valid.title = "Engineer";
    valid.company = "Acme";
    valid.appliedAt = "2026-06-01";
    expect(isFormValid(valid)).toBe(true);
  });

  it("allows empty optional fields when required fields are set", () => {
    const form = emptyForm();
    form.url = "https://jobs.example.com";
    form.title = "Engineer";
    form.company = "Acme";
    form.appliedAt = "2026-06-01";
    form.linkedinUrl = "";
    expect(isFormValid(form)).toBe(true);
  });
});

describe("getRequiredValidationState", () => {
  it("returns no invalid fields when showValidation is false", () => {
    const state = getRequiredValidationState(emptyForm(), false);
    expect(state.invalid).toEqual({ url: false, title: false, company: false, appliedAt: false });
    expect(state.errors).toEqual({});
  });

  it("marks empty required fields invalid when showValidation is true", () => {
    const form = emptyForm();
    form.appliedAt = "";
    const state = getRequiredValidationState(form, true);
    expect(state.invalid).toEqual({ url: true, title: true, company: true, appliedAt: true });
    expect(state.errors.url).toBe("Job Description URL is required.");
    expect(state.errors.title).toBe("Title is required.");
    expect(state.errors.company).toBe("Company is required.");
    expect(state.errors.appliedAt).toBe("Apply date is required.");
  });
});

describe("safeFormToInput", () => {
  it("returns parsed data for a valid form", () => {
    const form = emptyForm();
    form.url = "https://jobs.example.com";
    form.title = "Engineer";
    form.company = "Acme";
    form.appliedAt = "2026-06-01";

    const result = safeFormToInput(form);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.title).toBe("Engineer");
    }
  });

  it("returns an error for invalid required fields", () => {
    const result = safeFormToInput(emptyForm());
    expect(result.ok).toBe(false);
  });
});

describe("isFormPristine", () => {
  it("returns true when the form matches the application", () => {
    const application: JobApplication = {
      id: "id-1",
      url: "https://jobs.example.com",
      linkedinUrl: null,
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      viaRecruiter: false,
      recruiterName: null,
      recruiterFirm: null,
      contactEmail: null,
      contactPhone: null,
      fullJd: null,
      status: "applied",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    expect(isFormPristine(applicationToForm(application), application)).toBe(true);
  });

  it("returns false after the user edits a field", () => {
    const application: JobApplication = {
      id: "id-1",
      url: "https://jobs.example.com",
      linkedinUrl: null,
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      viaRecruiter: false,
      recruiterName: null,
      recruiterFirm: null,
      contactEmail: null,
      contactPhone: null,
      fullJd: null,
      status: "applied",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    const form = applicationToForm(application);
    form.title = "Staff Engineer";
    expect(isFormPristine(form, application)).toBe(false);
  });

  it("treats a status-only edit as clean for manual save", () => {
    const application: JobApplication = {
      id: "id-1",
      url: "https://jobs.example.com",
      linkedinUrl: null,
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      viaRecruiter: false,
      recruiterName: null,
      recruiterFirm: null,
      contactEmail: null,
      contactPhone: null,
      fullJd: null,
      status: "applied",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    const form = applicationToForm(application);
    form.status = "interviewing";

    expect(isFormPristine(form, application)).toBe(false);
    expect(isManualSaveFormDirty(form, application)).toBe(false);
    expect(isStatusOnlyFormChange(form, application)).toBe(true);
  });

  it("returns false for isStatusOnlyFormChange when a manual-save field differs", () => {
    const application: JobApplication = {
      id: "id-1",
      url: "https://jobs.example.com",
      linkedinUrl: null,
      title: "Engineer",
      company: "Acme",
      appliedAt: "2026-06-01",
      viaRecruiter: false,
      recruiterName: null,
      recruiterFirm: null,
      contactEmail: null,
      contactPhone: null,
      fullJd: null,
      status: "applied",
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
    };

    const form = applicationToForm(application);
    form.title = "Staff Engineer";

    expect(isStatusOnlyFormChange(form, application)).toBe(false);
  });
});

describe("formToInput", () => {
  it("strips the Y Combinator suffix from titles", () => {
    const form = emptyForm();
    form.url = "https://www.ycombinator.com/companies/acme/jobs/abc";
    form.title = "Founding Engineer | Y Combinator";
    form.company = "Acme";
    form.appliedAt = "2026-06-01";

    expect(formToInput(form).title).toBe("Founding Engineer");
  });
});
