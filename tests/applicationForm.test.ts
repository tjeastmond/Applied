import { describe, expect, it } from "vitest";
import { emptyForm, isFormValid } from "../src/lib/applicationForm";

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
    form.notes = "";
    expect(isFormValid(form)).toBe(true);
  });
});
