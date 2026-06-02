import { describe, expect, it } from "vitest";
import { emptyForm, formToInput, isFormValid } from "../src/lib/applicationForm";

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
