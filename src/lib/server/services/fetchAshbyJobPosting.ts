import { log } from "@/lib/server/logging/logger";
import { assertSafeFetchUrl } from "@/lib/server/urlSafety";
import { isGenericAshbyTitle, parseAshbyJobUrl, type AshbyJobPath, type AshbyRole } from "./extractAshbyRole";

const ASHBY_GRAPHQL_URL = "https://jobs.ashbyhq.com/api/non-user-graphql";
const ASHBY_BOARD_API_URL = "https://api.ashbyhq.com/posting-api/job-board";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const JOB_POSTING_QUERY = `
query JobPosting($organizationHostedJobsPageName: String!, $jobPostingId: String!) {
  jobPosting(
    organizationHostedJobsPageName: $organizationHostedJobsPageName
    jobPostingId: $jobPostingId
  ) {
    title
    descriptionHtml
    scrapeableCompensationSalarySummary
    compensationTierSummary
  }
}
`.trim();

type AshbyGraphqlResponse = {
  data?: {
    jobPosting?: {
      title?: string | null;
      descriptionHtml?: string | null;
      scrapeableCompensationSalarySummary?: string | null;
      compensationTierSummary?: string | null;
    } | null;
  };
};

type AshbyBoardJob = {
  id?: string;
  title?: string;
  descriptionHtml?: string;
  compensation?: {
    scrapeableCompensationSalarySummary?: string | null;
    compensationTierSummary?: string | null;
  };
};

type AshbyBoardResponse = {
  jobs?: AshbyBoardJob[];
};

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function roleFromGraphqlPosting(
  posting: NonNullable<AshbyGraphqlResponse["data"]>["jobPosting"],
  boardName: string,
): AshbyRole | null {
  if (!posting) return null;

  const title = readString(posting.title);
  if (!title || isGenericAshbyTitle(title)) return null;

  return {
    title,
    company: boardName,
    descriptionHtml: readString(posting.descriptionHtml) || null,
  };
}

function salaryFromGraphqlPosting(posting: NonNullable<AshbyGraphqlResponse["data"]>["jobPosting"]): string | null {
  if (!posting) return null;

  return readString(posting.scrapeableCompensationSalarySummary) || readString(posting.compensationTierSummary) || null;
}

async function fetchViaGraphql(jobPath: AshbyJobPath): Promise<{ role: AshbyRole; salaryRange: string | null } | null> {
  const url = new URL(ASHBY_GRAPHQL_URL);
  await assertSafeFetchUrl(url);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      operationName: "JobPosting",
      variables: {
        organizationHostedJobsPageName: jobPath.boardName,
        jobPostingId: jobPath.jobPostingId,
      },
      query: JOB_POSTING_QUERY,
    }),
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as AshbyGraphqlResponse;
  const posting = payload.data?.jobPosting;
  const role = roleFromGraphqlPosting(posting, jobPath.boardName);
  if (!role) return null;

  return { role, salaryRange: salaryFromGraphqlPosting(posting) };
}

async function fetchViaBoardApi(
  jobPath: AshbyJobPath,
): Promise<{ role: AshbyRole; salaryRange: string | null } | null> {
  const url = new URL(`${ASHBY_BOARD_API_URL}/${encodeURIComponent(jobPath.boardName)}`);
  url.searchParams.set("includeCompensation", "true");
  await assertSafeFetchUrl(url);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as AshbyBoardResponse;
  const job = payload.jobs?.find((entry) => entry.id === jobPath.jobPostingId);
  if (!job) return null;

  const title = readString(job.title);
  if (!title || isGenericAshbyTitle(title)) return null;

  const salaryRange =
    readString(job.compensation?.scrapeableCompensationSalarySummary) ||
    readString(job.compensation?.compensationTierSummary) ||
    null;

  return {
    role: {
      title,
      company: jobPath.boardName,
      descriptionHtml: readString(job.descriptionHtml) || null,
    },
    salaryRange,
  };
}

export async function fetchAshbyJobPostingFallback(
  pageUrl: URL,
): Promise<{ role: AshbyRole; salaryRange: string | null } | null> {
  const jobPath = parseAshbyJobUrl(pageUrl);
  if (!jobPath) return null;

  try {
    const graphqlResult = await fetchViaGraphql(jobPath);
    if (graphqlResult) return graphqlResult;

    return await fetchViaBoardApi(jobPath);
  } catch (error) {
    log.debug("ashby fallback fetch failed", {
      board: jobPath.boardName,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
