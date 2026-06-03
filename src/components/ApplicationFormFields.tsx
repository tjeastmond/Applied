import type { Ref } from "react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { ApplicationStatusPicker } from "@/components/ApplicationStatusPicker";
import { normalizePastedJobUrl, type FormState, type RequiredValidationState } from "@/lib/applicationForm";
import type { ApplicationStatus } from "@/types";

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

export function ApplicationFormFields({
  form,
  requiredValidation,
  isParsing,
  variant = "full",
  showStatus = false,
  stackedTitleCompany = false,
  autoParseOnUrlPaste = false,
  urlInputRef,
  updateField,
  onParse,
}: {
  form: FormState;
  requiredValidation: RequiredValidationState;
  isParsing: boolean;
  variant?: "minimal" | "full";
  showStatus?: boolean;
  stackedTitleCompany?: boolean;
  autoParseOnUrlPaste?: boolean;
  urlInputRef?: Ref<HTMLInputElement>;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onParse: (urlOverride?: string) => void;
}) {
  const minimal = variant === "minimal";
  const { invalid, errors } = requiredValidation;

  const companyField = (
    <Field data-invalid={invalid.company || undefined}>
      <FieldLabel htmlFor="company">
        Company <RequiredMark />
      </FieldLabel>
      <Input
        id="company"
        placeholder="Acme Inc."
        value={form.company}
        aria-invalid={invalid.company}
        onChange={(e) => updateField("company", e.target.value)}
      />
      <FieldError>{errors.company}</FieldError>
    </Field>
  );

  return (
    <FieldGroup>
      <Field data-invalid={invalid.url || undefined}>
        <FieldLabel htmlFor="url">
          Job Description URL <RequiredMark />
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            ref={urlInputRef}
            id="url"
            type="url"
            placeholder="https://…"
            value={form.url}
            aria-invalid={invalid.url}
            onChange={(e) => updateField("url", e.target.value)}
            onPaste={
              autoParseOnUrlPaste
                ? (e) => {
                    const pastedUrl = normalizePastedJobUrl(e.clipboardData.getData("text"));
                    if (!pastedUrl || isParsing) return;
                    e.preventDefault();
                    updateField("url", pastedUrl);
                    if (pastedUrl === form.url.trim()) return;
                    onParse(pastedUrl);
                  }
                : undefined
            }
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              variant="secondary"
              disabled={isParsing || !form.url.trim()}
              onClick={() => onParse()}
            >
              {isParsing ? "Parsing…" : "Parse"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldError>{errors.url}</FieldError>
      </Field>

      <Field data-invalid={invalid.title || undefined}>
        <FieldLabel htmlFor="title">
          Title <RequiredMark />
        </FieldLabel>
        <Input
          id="title"
          placeholder="Senior Engineer"
          value={form.title}
          aria-invalid={invalid.title}
          onChange={(e) => updateField("title", e.target.value)}
        />
        <FieldError>{errors.title}</FieldError>
      </Field>

      {stackedTitleCompany ? companyField : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {!stackedTitleCompany ? companyField : null}
        <Field data-invalid={invalid.appliedAt || undefined}>
          <FieldLabel htmlFor="appliedAt">
            Applied <RequiredMark />
          </FieldLabel>
          <Input
            id="appliedAt"
            type="date"
            value={form.appliedAt}
            aria-invalid={invalid.appliedAt}
            onChange={(e) => updateField("appliedAt", e.target.value)}
          />
          <FieldError>{errors.appliedAt}</FieldError>
        </Field>
        {showStatus && !minimal ? (
          <Field>
            <FieldLabel>Status</FieldLabel>
            <ApplicationStatusPicker
              status={form.status}
              onStatusChange={(value: ApplicationStatus) => updateField("status", value)}
            />
          </Field>
        ) : null}
      </div>

      {minimal ? null : (
        <>
          <Field>
            <FieldLabel htmlFor="linkedinUrl">Company LinkedIn URL</FieldLabel>
            <Input
              id="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/…"
              value={form.linkedinUrl ?? ""}
              onChange={(e) => updateField("linkedinUrl", e.target.value)}
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="recruiterName">Contact Name</FieldLabel>
              <Input
                id="recruiterName"
                placeholder="Jane Doe"
                value={form.recruiterName ?? ""}
                onChange={(e) => updateField("recruiterName", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="recruiterFirm">Recruiter Firm</FieldLabel>
              <Input
                id="recruiterFirm"
                placeholder="TechRecruit LLC"
                value={form.recruiterFirm ?? ""}
                onChange={(e) => updateField("recruiterFirm", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="contactEmail">Contact Email</FieldLabel>
              <Input
                id="contactEmail"
                type="email"
                placeholder="name@company.com"
                value={form.contactEmail ?? ""}
                onChange={(e) => updateField("contactEmail", e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="contactPhone">Contact Phone</FieldLabel>
              <Input
                id="contactPhone"
                type="tel"
                placeholder="555-123-4567"
                value={form.contactPhone ?? ""}
                onChange={(e) => updateField("contactPhone", e.target.value)}
              />
            </Field>
          </div>
        </>
      )}
    </FieldGroup>
  );
}
