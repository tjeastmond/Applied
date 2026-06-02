import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import type { FormState } from "@/lib/applicationForm";
import type { ApplicationStatus } from "@/types";

function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

const STATUS_OPTIONS: { value: ApplicationStatus; label: string }[] = [
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "rejected", label: "Rejected" },
  { value: "offer", label: "Offer" },
];

export function ApplicationFormFields({
  form,
  showValidation,
  isParsing,
  showStatus = false,
  stackedTitleCompany = false,
  updateField,
  onParse,
}: {
  form: FormState;
  showValidation: boolean;
  isParsing: boolean;
  showStatus?: boolean;
  stackedTitleCompany?: boolean;
  updateField: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  onParse: () => void;
}) {
  const urlInvalid = showValidation && form.url.trim().length === 0;
  const titleInvalid = showValidation && (form.title?.trim().length ?? 0) === 0;
  const companyInvalid = showValidation && (form.company?.trim().length ?? 0) === 0;
  const appliedInvalid = showValidation && (form.appliedAt?.trim().length ?? 0) === 0;

  return (
    <FieldGroup>
      <Field data-invalid={urlInvalid || undefined}>
        <FieldLabel htmlFor="url">
          Job Posting URL <RequiredMark />
        </FieldLabel>
        <InputGroup>
          <InputGroupInput
            id="url"
            type="url"
            placeholder="https://…"
            value={form.url}
            aria-invalid={urlInvalid}
            onChange={(e) => updateField("url", e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton variant="secondary" disabled={isParsing || !form.url.trim()} onClick={onParse}>
              {isParsing ? "Parsing…" : "Parse"}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        <FieldError>{urlInvalid && "Job posting URL is required."}</FieldError>
      </Field>

      <Field data-invalid={titleInvalid || undefined}>
        <FieldLabel htmlFor="title">
          Title <RequiredMark />
        </FieldLabel>
        <Input
          id="title"
          placeholder="Senior Engineer"
          value={form.title ?? ""}
          aria-invalid={titleInvalid}
          onChange={(e) => updateField("title", e.target.value)}
        />
        <FieldError>{titleInvalid && "Title is required."}</FieldError>
      </Field>

      {stackedTitleCompany ? (
        <Field data-invalid={companyInvalid || undefined}>
          <FieldLabel htmlFor="company">
            Company <RequiredMark />
          </FieldLabel>
          <Input
            id="company"
            placeholder="Acme Inc."
            value={form.company ?? ""}
            aria-invalid={companyInvalid}
            onChange={(e) => updateField("company", e.target.value)}
          />
          <FieldError>{companyInvalid && "Company is required."}</FieldError>
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        {!stackedTitleCompany ? (
          <Field data-invalid={companyInvalid || undefined}>
            <FieldLabel htmlFor="company">
              Company <RequiredMark />
            </FieldLabel>
            <Input
              id="company"
              placeholder="Acme Inc."
              value={form.company ?? ""}
              aria-invalid={companyInvalid}
              onChange={(e) => updateField("company", e.target.value)}
            />
            <FieldError>{companyInvalid && "Company is required."}</FieldError>
          </Field>
        ) : null}
        <Field data-invalid={appliedInvalid || undefined}>
          <FieldLabel htmlFor="appliedAt">
            Applied <RequiredMark />
          </FieldLabel>
          <Input
            id="appliedAt"
            type="date"
            value={form.appliedAt ?? ""}
            aria-invalid={appliedInvalid}
            onChange={(e) => updateField("appliedAt", e.target.value)}
          />
          <FieldError>{appliedInvalid && "Apply date is required."}</FieldError>
        </Field>
        {showStatus ? (
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <select
              id="status"
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 h-9 w-full rounded-md border px-2.5 text-sm outline-none focus-visible:ring-3"
              value={form.status ?? "applied"}
              onChange={(e) => updateField("status", e.target.value as ApplicationStatus)}
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
      </div>

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
    </FieldGroup>
  );
}
