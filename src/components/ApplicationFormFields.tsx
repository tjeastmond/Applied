import type { ReactNode, Ref } from "react";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { ApplicationStatusPicker } from "@/components/ApplicationStatusPicker";
import { Separator } from "@/components/ui/separator";
import { normalizePastedJobUrl, type FormState, type RequiredValidationState } from "@/lib/applicationForm";
import type { ApplicationStatus } from "@/types";

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

function DetailSection({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-5 px-6">{children}</div>;
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
  onStatusChange,
  onParse,
}: {
  form: FormState;
  requiredValidation: RequiredValidationState;
  isParsing: boolean;
  variant?: "minimal" | "full" | "detail";
  showStatus?: boolean;
  stackedTitleCompany?: boolean;
  autoParseOnUrlPaste?: boolean;
  urlInputRef?: Ref<HTMLInputElement>;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onStatusChange?: (status: ApplicationStatus) => void;
  onParse: (urlOverride?: string) => void;
}) {
  const minimal = variant === "minimal";
  const detail = variant === "detail";
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

  const urlField = (
    <Field data-invalid={invalid.url || undefined}>
      <FieldLabel htmlFor="url">
        Job Description URL <RequiredMark />
      </FieldLabel>
      {detail ? (
        <Input
          ref={urlInputRef}
          id="url"
          type="url"
          placeholder="https://…"
          value={form.url}
          aria-invalid={invalid.url}
          onChange={(e) => updateField("url", e.target.value)}
        />
      ) : (
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
            <InputGroupButton variant="secondary" disabled={isParsing || !form.url.trim()} onClick={() => onParse()}>
              {isParsing ? "Parsing…" : "Parse"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      )}
      <FieldError>{errors.url}</FieldError>
    </Field>
  );

  const titleField = (
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
  );

  const mainFields = (
    <>
      {titleField}
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
              size="field"
              status={form.status}
              onStatusChange={onStatusChange ?? ((value: ApplicationStatus) => updateField("status", value))}
            />
          </Field>
        ) : null}
      </div>
      {minimal ? null : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="salaryRange">Salary Range</FieldLabel>
            <Input
              id="salaryRange"
              placeholder="$150k–$180k"
              value={form.salaryRange ?? ""}
              onChange={(e) => updateField("salaryRange", e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="desiredSalary">Desired Salary</FieldLabel>
            <Input
              id="desiredSalary"
              placeholder="$175k"
              value={form.desiredSalary ?? ""}
              onChange={(e) => updateField("desiredSalary", e.target.value)}
            />
          </Field>
        </div>
      )}
    </>
  );

  const contactPhoneField = (
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
  );

  const contactEmailField = (
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
  );

  const contactFields = minimal ? null : (
    <>
      <Field>
        <FieldLabel htmlFor="linkedinUrl">Company LinkedIn</FieldLabel>
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
        {detail ? contactEmailField : contactPhoneField}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {detail ? contactPhoneField : contactEmailField}
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
    </>
  );

  if (detail) {
    return (
      <FieldGroup>
        <DetailSection>{urlField}</DetailSection>
        <Separator />
        <DetailSection>{mainFields}</DetailSection>
        {contactFields ? (
          <>
            <Separator />
            <DetailSection>{contactFields}</DetailSection>
          </>
        ) : null}
      </FieldGroup>
    );
  }

  return (
    <FieldGroup>
      {urlField}
      {mainFields}
      {contactFields ? (
        <>
          <Separator />
          {contactFields}
        </>
      ) : null}
    </FieldGroup>
  );
}
