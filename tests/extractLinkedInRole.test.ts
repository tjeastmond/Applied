import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  extractLinkedInRole,
  isLinkedInHost,
  parseLinkedInTitleLikeText,
} from "@/lib/server/services/extractLinkedInRole";

function docFromHtml(html: string): Document {
  return parseHTML(html).document;
}

describe("isLinkedInHost", () => {
  it("recognizes linkedin.com hosts", () => {
    expect(isLinkedInHost("www.linkedin.com")).toBe(true);
    expect(isLinkedInHost("linkedin.com")).toBe(true);
    expect(isLinkedInHost("uk.linkedin.com")).toBe(true);
  });

  it("rejects non-linkedin hosts", () => {
    expect(isLinkedInHost("www.paraform.com")).toBe(false);
    expect(isLinkedInHost("jobs.ashbyhq.com")).toBe(false);
    expect(isLinkedInHost("notlinkedin.com")).toBe(false);
  });
});

describe("parseLinkedInTitleLikeText", () => {
  it("parses the standard Company hiring Title | Location | LinkedIn format", () => {
    expect(
      parseLinkedInTitleLikeText(
        "Crossing Hurdles hiring Software Engineer (Node.js/React) | Remote in United States | LinkedIn",
      ),
    ).toEqual({
      company: "Crossing Hurdles",
      title: "Software Engineer (Node.js/React)",
    });
  });

  it("parses titles with complex punctuation", () => {
    expect(
      parseLinkedInTitleLikeText("Acme Corp hiring Senior SWE - Platform/API (L5) | San Francisco, CA | LinkedIn"),
    ).toEqual({
      company: "Acme Corp",
      title: "Senior SWE - Platform/API (L5)",
    });
  });

  it("is case-insensitive for hiring and LinkedIn markers", () => {
    expect(parseLinkedInTitleLikeText("Ramp hiring Staff Engineer | New York, NY | linkedin")).toEqual({
      company: "Ramp",
      title: "Staff Engineer",
    });
  });

  it("trims surrounding whitespace", () => {
    expect(parseLinkedInTitleLikeText("  Linear hiring Product Manager | Remote | LinkedIn  ")).toEqual({
      company: "Linear",
      title: "Product Manager",
    });
  });

  it("returns null for non-linkedin title formats", () => {
    expect(parseLinkedInTitleLikeText("Staff Engineer at Ramp")).toBeNull();
    expect(parseLinkedInTitleLikeText("Software Engineer | LinkedIn")).toBeNull();
    expect(parseLinkedInTitleLikeText("")).toBeNull();
    expect(parseLinkedInTitleLikeText("Acme hiring Engineer | Remote")).toBeNull();
  });
});

describe("extractLinkedInRole", () => {
  it("extracts title and company from JSON-LD JobPosting", () => {
    const document = docFromHtml(`<html><head>
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "title": "Backend Engineer",
        "hiringOrganization": { "name": "Stripe" }
      }</script>
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Backend Engineer",
      company: "Stripe",
    });
  });

  it("ignores JSON-LD records that are not JobPosting", () => {
    const document = docFromHtml(`<html><head>
      <script type="application/ld+json">{
        "@type": "Organization",
        "title": "Backend Engineer",
        "hiringOrganization": { "name": "Stripe" }
      }</script>
      <meta property="og:title" content="Notion hiring Backend Engineer | Remote | LinkedIn" />
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Backend Engineer",
      company: "Notion",
    });
  });

  it("falls back to og:title", () => {
    const document = docFromHtml(`<html><head>
      <meta property="og:title" content="Figma hiring Design Engineer | San Francisco, CA | LinkedIn" />
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Design Engineer",
      company: "Figma",
    });
  });

  it("falls back to meta name=title", () => {
    const document = docFromHtml(`<html><head>
      <meta name="title" content="Vercel hiring Platform Engineer | Remote | LinkedIn" />
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Platform Engineer",
      company: "Vercel",
    });
  });

  it("falls back to document title", () => {
    const document = docFromHtml(`<html><head>
      <title>Datadog hiring Site Reliability Engineer | Boston, MA | LinkedIn</title>
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Site Reliability Engineer",
      company: "Datadog",
    });
  });

  it("prefers JSON-LD over og:title and document title", () => {
    const document = docFromHtml(`<html><head>
      <title>Wrong Co hiring Wrong Role | Somewhere | LinkedIn</title>
      <meta property="og:title" content="Also Wrong hiring Also Wrong | Somewhere | LinkedIn" />
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "title": "Correct Role",
        "hiringOrganization": { "name": "Correct Co" }
      }</script>
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Correct Role",
      company: "Correct Co",
    });
  });

  it("prefers og:title over meta name=title and document title", () => {
    const document = docFromHtml(`<html><head>
      <title>Wrong Co hiring Wrong Role | Somewhere | LinkedIn</title>
      <meta name="title" content="Also Wrong hiring Also Wrong | Somewhere | LinkedIn" />
      <meta property="og:title" content="Ramp hiring Staff Engineer | New York, NY | LinkedIn" />
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Staff Engineer",
      company: "Ramp",
    });
  });

  it("prefers meta name=title over document title", () => {
    const document = docFromHtml(`<html><head>
      <title>Wrong Co hiring Wrong Role | Somewhere | LinkedIn</title>
      <meta name="title" content="Linear hiring Product Manager | Remote | LinkedIn" />
    </head></html>`);

    expect(extractLinkedInRole(document)).toEqual({
      title: "Product Manager",
      company: "Linear",
    });
  });

  it("returns null when no extractable role data is present", () => {
    const document = docFromHtml(`<html><head>
      <title>LinkedIn</title>
    </head></html>`);

    expect(extractLinkedInRole(document)).toBeNull();
  });
});
