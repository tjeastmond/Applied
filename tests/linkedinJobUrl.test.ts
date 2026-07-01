import { describe, expect, it } from "vitest";
import { canonicalizeLinkedInJobUrl, isLinkedInHost } from "@/lib/linkedinJobUrl";

describe("isLinkedInHost", () => {
  it("recognizes linkedin.com hosts", () => {
    expect(isLinkedInHost("www.linkedin.com")).toBe(true);
    expect(isLinkedInHost("linkedin.com")).toBe(true);
    expect(isLinkedInHost("uk.linkedin.com")).toBe(true);
  });

  it("rejects non-linkedin hosts", () => {
    expect(isLinkedInHost("jobs.example.com")).toBe(false);
  });
});

describe("canonicalizeLinkedInJobUrl", () => {
  it("strips query params from linkedin job view URLs", () => {
    expect(
      canonicalizeLinkedInJobUrl(
        "https://www.linkedin.com/jobs/view/4426925841/?alternateChannel=search&trackingId=abc",
      ),
    ).toBe("https://www.linkedin.com/jobs/view/4426925841/");
  });

  it("adds a trailing slash when missing", () => {
    expect(canonicalizeLinkedInJobUrl("https://www.linkedin.com/jobs/view/4426925841")).toBe(
      "https://www.linkedin.com/jobs/view/4426925841/",
    );
  });

  it("leaves non-linkedin URLs unchanged", () => {
    const url = "https://jobs.example.com/posting?ref=abc";
    expect(canonicalizeLinkedInJobUrl(url)).toBe(url);
  });

  it("leaves non-job linkedin URLs unchanged", () => {
    const url = "https://www.linkedin.com/company/acme/?trk=foo";
    expect(canonicalizeLinkedInJobUrl(url)).toBe(url);
  });
});
