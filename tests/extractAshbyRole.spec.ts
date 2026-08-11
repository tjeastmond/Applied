import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import {
  extractAshbyRole,
  isAshbyHost,
  isGenericAshbyTitle,
  parseAshbyJobUrl,
} from "@/lib/server/services/extractAshbyRole";

function docFromHtml(html: string): Document {
  return parseHTML(html).document;
}

describe("isAshbyHost", () => {
  it("recognizes Ashby job board hosts", () => {
    expect(isAshbyHost("jobs.ashbyhq.com")).toBe(true);
    expect(isAshbyHost("www.jobs.ashbyhq.com")).toBe(true);
    expect(isAshbyHost("careers.example.com")).toBe(false);
  });
});

describe("parseAshbyJobUrl", () => {
  it("extracts board name and posting id from job URLs", () => {
    expect(parseAshbyJobUrl(new URL("https://jobs.ashbyhq.com/Clera/82edc68f-40a8-4623-a5e0-028ec0ee8c51"))).toEqual({
      boardName: "Clera",
      jobPostingId: "82edc68f-40a8-4623-a5e0-028ec0ee8c51",
    });
  });

  it("returns null for board index URLs", () => {
    expect(parseAshbyJobUrl(new URL("https://jobs.ashbyhq.com/Clera"))).toBeNull();
  });
});

describe("isGenericAshbyTitle", () => {
  it("treats board shell titles as generic", () => {
    expect(isGenericAshbyTitle("Jobs")).toBe(true);
    expect(isGenericAshbyTitle("careers")).toBe(true);
    expect(isGenericAshbyTitle("Account Executive")).toBe(false);
  });
});

describe("extractAshbyRole", () => {
  it("extracts title and company from embedded app data", () => {
    const html = `<html><body><script>
      window.__appData = {"organization":{"name":"Ramp"},"posting":{"title":"Security Engineer, Cloud","descriptionHtml":"<p>About the role</p>"}};
    </script></body></html>`;

    expect(extractAshbyRole(docFromHtml(html), html)).toEqual({
      title: "Security Engineer, Cloud",
      company: "Ramp",
      descriptionHtml: "<p>About the role</p>",
    });
  });

  it("extracts title and company from meta title suffixes", () => {
    const html = `<html><head>
      <meta name="title" content="Account Executive @ Clera" />
      <meta property="og:title" content="Account Executive" />
    </head></html>`;

    expect(extractAshbyRole(docFromHtml(html), html)).toEqual({
      title: "Account Executive",
      company: "Clera",
      descriptionHtml: null,
    });
  });

  it("ignores generic Jobs shell titles", () => {
    const html = `<html><head><title>Jobs</title></head><body><script>
      window.__appData = {"organization":null,"posting":null};
    </script></body></html>`;

    expect(extractAshbyRole(docFromHtml(html), html)).toBeNull();
  });
});
