import { describe, expect, it } from "vitest";
import { parseHTML } from "linkedom";
import { extractParaformRole, isParaformHost } from "@/lib/server/services/extractParaformRole";

function docFromHtml(html: string): Document {
  return parseHTML(html).document;
}

describe("isParaformHost", () => {
  it("recognizes paraform.com hosts", () => {
    expect(isParaformHost("www.paraform.com")).toBe(true);
    expect(isParaformHost("paraform.com")).toBe(true);
    expect(isParaformHost("jobs.ashbyhq.com")).toBe(false);
  });
});

describe("extractParaformRole", () => {
  it("extracts title and company from /share/ initialRoleData", () => {
    const document = docFromHtml(`<html><head>
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

    expect(extractParaformRole(document)).toEqual({
      title: "Staff Engineer",
      company: "Ramp",
    });
  });

  it("falls back to og:title in Title at Company format", () => {
    const document = docFromHtml(`<html><head>
      <meta property="og:title" content="Founding Engineer at Fathom" />
    </head></html>`);

    expect(extractParaformRole(document)).toEqual({
      title: "Founding Engineer",
      company: "Fathom",
    });
  });

  it("extracts title and company from /company/ baseRole and baseCompany", () => {
    const document = docFromHtml(`<html><head>
      <title>Security Engineer at Acme Corp</title>
      <meta property="og:title" content="Acme Corp" />
      <script id="__NEXT_DATA__" type="application/json">{
        "props": {
          "pageProps": {
            "page_title": "Security Engineer at Acme Corp",
            "company_name": "Acme Corp",
            "baseRole": { "name": "Security Engineer" },
            "baseCompany": { "name": "Acme Corp" }
          }
        }
      }</script>
    </head></html>`);

    expect(extractParaformRole(document)).toEqual({
      title: "Security Engineer",
      company: "Acme Corp",
    });
  });

  it("falls back to the role header markup on share pages", () => {
    const document = docFromHtml(`<html><body>
      <div>
        <div class="-mb-1 font-normal text-neutral-700">Linear</div>
        <div class="mt-1 text-2xl font-book">Product Manager</div>
      </div>
    </body></html>`);

    expect(extractParaformRole(document)).toEqual({
      title: "Product Manager",
      company: "Linear",
    });
  });
});
