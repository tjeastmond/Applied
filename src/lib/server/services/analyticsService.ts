import { APPLICATION_STATUS_OPTIONS, type ApplicationStatus } from "@/lib/applicationStatus";
import type { AnalyticsFilters, AnalyticsResponse } from "@/lib/schemas/analytics";
import { getAnalyticsRepository } from "@/lib/server/db";
import type { AnalyticsApplicationRecord, AnalyticsRepository } from "@/lib/server/repositories/analyticsRepository";

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_PIPELINE_STATUSES = new Set<ApplicationStatus>(["applied", "interviewing", "waiting"]);
const AMBIGUOUS_BACKFILL_STATUSES = new Set<ApplicationStatus>(["waiting", "no_response", "rejected", "passed"]);
const UNKNOWN_COMPANY = "Unknown Company";

type BucketCadence = "daily" | "weekly" | "monthly";

type DateBounds = {
  from: string | null;
  to: string | null;
};

type MutableCompanyAnalytics = {
  applications: number;
  eligible: number;
  interviewed: number;
  offers: number;
  latestAppliedAt: string;
};

function dateAtUtc(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(value: string, days: number): string {
  const date = dateAtUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

function addMonths(value: string, months: number): string {
  const date = dateAtUtc(value);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return isoDate(date);
}

function resolveDateBounds(query: AnalyticsFilters, today: string): DateBounds {
  switch (query.range) {
    case "30d":
      return { from: addDays(today, -29), to: today };
    case "90d":
      return { from: addDays(today, -89), to: today };
    case "6m":
      return { from: addDays(addMonths(today, -6), 1), to: today };
    case "12m":
      return { from: addDays(addMonths(today, -12), 1), to: today };
    case "all":
      return { from: null, to: null };
    case "custom":
      return { from: query.from ?? null, to: query.to ?? null };
    default: {
      const exhaustive: never = query.range;
      return exhaustive;
    }
  }
}

function inclusiveDayCount(from: string, to: string): number {
  return Math.floor((dateAtUtc(to).getTime() - dateAtUtc(from).getTime()) / DAY_MS) + 1;
}

function cadenceForSpan(from: string, to: string): BucketCadence {
  const days = inclusiveDayCount(from, to);
  if (days <= 45) return "daily";
  if (days <= 180) return "weekly";
  return "monthly";
}

function mondayOnOrBefore(value: string): string {
  const date = dateAtUtc(value);
  const day = date.getUTCDay();
  return addDays(value, -(day === 0 ? 6 : day - 1));
}

function monthStart(value: string): string {
  const date = dateAtUtc(value);
  date.setUTCDate(1);
  return isoDate(date);
}

function monthEnd(value: string): string {
  const date = dateAtUtc(value);
  date.setUTCMonth(date.getUTCMonth() + 1, 0);
  return isoDate(date);
}

function bucketStartFor(value: string, cadence: BucketCadence): string {
  switch (cadence) {
    case "daily":
      return value;
    case "weekly":
      return mondayOnOrBefore(value);
    case "monthly":
      return monthStart(value);
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

function bucketEndFor(value: string, cadence: BucketCadence): string {
  switch (cadence) {
    case "daily":
      return value;
    case "weekly":
      return addDays(value, 6);
    case "monthly":
      return monthEnd(value);
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

function nextBucket(value: string, cadence: BucketCadence): string {
  switch (cadence) {
    case "daily":
      return addDays(value, 1);
    case "weekly":
      return addDays(value, 7);
    case "monthly":
      return monthStart(addMonths(value, 1));
    default: {
      const exhaustive: never = cadence;
      return exhaustive;
    }
  }
}

function bucketLabel(value: string, cadence: BucketCadence): string {
  const options: Intl.DateTimeFormatOptions =
    cadence === "monthly"
      ? { month: "short", year: "numeric", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-US", options).format(dateAtUtc(value));
}

function percentage(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function hasInterviewed(application: AnalyticsApplicationRecord): boolean {
  return (
    application.everInterviewing ||
    application.everOffer ||
    application.status === "interviewing" ||
    application.status === "offer"
  );
}

function hasOffer(application: AnalyticsApplicationRecord): boolean {
  return application.everOffer || application.status === "offer";
}

/**
 * Migration backfills one null-from event at createdAt. That shape is also valid
 * for a genuine initial event, so only downstream statuses whose prior interview
 * stage is genuinely ambiguous are flagged. Interviewing and offer remain
 * reliable because the current state itself establishes conversion.
 */
function looksHistoryIncomplete(application: AnalyticsApplicationRecord): boolean {
  return (
    application.status !== "to_apply" &&
    AMBIGUOUS_BACKFILL_STATUSES.has(application.status) &&
    application.historyCount === 1 &&
    application.initialFromStatus === null &&
    application.initialToStatus === application.status &&
    application.initialChangedAt === application.createdAt
  );
}

function buildVolume(applications: readonly AnalyticsApplicationRecord[], from: string | null, to: string | null) {
  if (!from || !to) return [];

  const cadence = cadenceForSpan(from, to);
  const firstBucket = bucketStartFor(from, cadence);
  const finalBucket = bucketStartFor(to, cadence);
  const counts = new Map<string, number>();
  for (const application of applications) {
    const key = bucketStartFor(application.appliedAt, cadence);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const volume: AnalyticsResponse["volume"] = [];
  for (let bucket = firstBucket; bucket <= finalBucket; bucket = nextBucket(bucket, cadence)) {
    volume.push({
      bucketStart: bucket,
      bucketEnd: bucketEndFor(bucket, cadence),
      label: bucketLabel(bucket, cadence),
      count: counts.get(bucket) ?? 0,
    });
  }
  return volume;
}

export async function buildAnalytics(
  query: AnalyticsFilters,
  repository: AnalyticsRepository = getAnalyticsRepository(),
  now: Date = new Date(),
): Promise<AnalyticsResponse> {
  const generatedAt = now.toISOString();
  const today = isoDate(now);
  const requestedBounds = resolveDateBounds(query, today);
  const snapshot = await repository.loadSnapshot({
    from: requestedBounds.from,
    to: requestedBounds.to,
    companies: query.companies,
    statuses: query.statuses,
    includeArchived: query.includeArchived,
  });
  const applications = snapshot.applications;
  const eligibleApplications = applications.filter((application) => application.status !== "to_apply");
  const interviewedApplications = eligibleApplications.filter(hasInterviewed);
  const offerApplications = eligibleApplications.filter(hasOffer);
  const activePipeline = applications.filter((application) => ACTIVE_PIPELINE_STATUSES.has(application.status)).length;

  const statusCounts = new Map<ApplicationStatus, number>();
  const companyCounts = new Map<string, MutableCompanyAnalytics>();
  for (const application of applications) {
    statusCounts.set(application.status, (statusCounts.get(application.status) ?? 0) + 1);

    const company = application.company?.trim() || UNKNOWN_COMPANY;
    const current = companyCounts.get(company) ?? {
      applications: 0,
      eligible: 0,
      interviewed: 0,
      offers: 0,
      latestAppliedAt: application.appliedAt,
    };
    current.applications += 1;
    if (application.status !== "to_apply") current.eligible += 1;
    if (application.status !== "to_apply" && hasInterviewed(application)) current.interviewed += 1;
    if (application.status !== "to_apply" && hasOffer(application)) current.offers += 1;
    if (application.appliedAt > current.latestAppliedAt) current.latestAppliedAt = application.appliedAt;
    companyCounts.set(company, current);
  }

  let volumeBounds = requestedBounds;
  if (query.range === "all" && applications.length > 0) {
    volumeBounds = {
      from: applications[0]?.appliedAt ?? null,
      to: applications.at(-1)?.appliedAt ?? null,
    };
  }

  return {
    generatedAt,
    allTimeApplicationCount: snapshot.allTimeApplicationCount,
    cohort: {
      applications: applications.length,
      activePipeline,
      eligible: eligibleApplications.length,
      interviewed: interviewedApplications.length,
      offers: offerApplications.length,
    },
    rates: {
      activePipeline: percentage(activePipeline, eligibleApplications.length),
      interview: percentage(interviewedApplications.length, eligibleApplications.length),
      offer: percentage(offerApplications.length, eligibleApplications.length),
    },
    volume: buildVolume(applications, volumeBounds.from, volumeBounds.to),
    status: APPLICATION_STATUS_OPTIONS.map(({ value }) => ({
      status: value,
      count: statusCounts.get(value) ?? 0,
      percentage: percentage(statusCounts.get(value) ?? 0, applications.length),
    })),
    companies: [...companyCounts.entries()]
      .map(([company, counts]) => ({
        company,
        applications: counts.applications,
        interviewed: counts.interviewed,
        offers: counts.offers,
        interviewRate: percentage(counts.interviewed, counts.eligible),
        latestAppliedAt: counts.latestAppliedAt,
      }))
      .sort((left, right) => right.applications - left.applications || left.company.localeCompare(right.company)),
    historyIncomplete: eligibleApplications.some(looksHistoryIncomplete),
    sparse: eligibleApplications.length < 5,
  };
}
