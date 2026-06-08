import { describe, expect, it } from "vitest";
import { filterApplicationsBySearch } from "../src/lib/applicationSearch";
import { makeJobApplication } from "./fixtures/jobApplication";

describe("applicationSearch", () => {
  it("returns all applications when search query is empty", () => {
    const applications = [makeJobApplication({ id: "a" }), makeJobApplication({ id: "b" })];
    expect(filterApplicationsBySearch(applications, "")).toEqual(applications);
  });

  it("matches title, company, url, and recruiter fields", () => {
    const applications = [
      makeJobApplication({ id: "a", title: "Engineer" }),
      makeJobApplication({ id: "b", company: "Globex" }),
      makeJobApplication({ id: "c", url: "https://jobs.example.com/backend" }),
      makeJobApplication({ id: "d", recruiterName: "Jordan Lee" }),
    ];
    expect(filterApplicationsBySearch(applications, "engineer").map((item) => item.id)).toEqual(["a"]);
    expect(filterApplicationsBySearch(applications, "globex").map((item) => item.id)).toEqual(["b"]);
    expect(filterApplicationsBySearch(applications, "backend").map((item) => item.id)).toEqual(["c"]);
    expect(filterApplicationsBySearch(applications, "jordan").map((item) => item.id)).toEqual(["d"]);
  });
});
