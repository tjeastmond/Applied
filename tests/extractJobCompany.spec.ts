import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { extractJobCompany, isJobBoardHost } from "@/lib/server/services/extractJobCompany";

function docFromHtml(html: string): Document {
  return parseHTML(html).document;
}

describe("isJobBoardHost", () => {
  it("recognizes Y Combinator, Ashby, and Paraform hosts", () => {
    expect(isJobBoardHost("www.ycombinator.com")).toBe(true);
    expect(isJobBoardHost("jobs.ashbyhq.com")).toBe(true);
    expect(isJobBoardHost("www.paraform.com")).toBe(true);
    expect(isJobBoardHost("careers.stripe.com")).toBe(false);
  });
});

describe("extractJobCompany", () => {
  it("prefers JSON-LD hiringOrganization over job board site name", () => {
    const document = docFromHtml(`<html><head>
      <meta property="og:site_name" content="Y Combinator" />
      <meta name="title" content="Engineer at Fathom" />
      <script type="application/ld+json">{
        "@type": "JobPosting",
        "hiringOrganization": { "name": "Fathom" }
      }</script>
    </head></html>`);

    const company = extractJobCompany(new URL("https://www.ycombinator.com/companies/fathom/jobs/x"), document, {
      siteName: "Y Combinator",
      applicationName: null,
      hostnameFallback: "Ycombinator",
    });

    expect(company).toBe("Fathom");
  });

  it("parses Ashby title suffixes", () => {
    const document = docFromHtml(`<html><head>
      <meta name="title" content="Staff Engineer @ Linear" />
    </head></html>`);

    const company = extractJobCompany(new URL("https://jobs.ashbyhq.com/linear/job-id"), document, {
      siteName: null,
      applicationName: null,
      hostnameFallback: "Ashbyhq",
    });

    expect(company).toBe("Linear");
  });

  it("extracts the hiring company from Paraform share pages", () => {
    const document = docFromHtml(`<html><head>
      <meta property="og:title" content="Staff Engineer at Ramp" />
      <script id="__NEXT_DATA__" type="application/json">{
        "props": {
          "pageProps": {
            "initialRoleData": {
              "name": "Staff Engineer",
              "company": { "name": "Ramp" }
            }
          }
        }
      }</script>
    </head></html>`);

    const company = extractJobCompany(new URL("https://www.paraform.com/share/ramp/cm123abc"), document, {
      siteName: "Paraform",
      applicationName: null,
      hostnameFallback: "Paraform",
    });

    expect(company).toBe("Ramp");
  });

  it("falls back to raw slug when percent-encoding is invalid", () => {
    const document = docFromHtml("<html></html>");
    const company = extractJobCompany(new URL("https://www.ycombinator.com/companies/acme%ZZcorp/jobs/x"), document, {
      siteName: null,
      applicationName: null,
      hostnameFallback: null,
    });

    expect(company).toBe("Acme%zzcorp");
  });
});
