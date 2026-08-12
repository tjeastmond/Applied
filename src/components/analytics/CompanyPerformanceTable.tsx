"use client";

import { useState } from "react";
import { Building2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAnalyticsCompanyCount, formatAnalyticsRate, type AnalyticsResponse } from "@/lib/analytics";

type CompanyPerformance = AnalyticsResponse["companies"][number];

function formatAppliedDate(value: string): string {
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function CompanyPerformanceTable({
  companies,
  onCompanySelect,
}: {
  companies: CompanyPerformance[];
  onCompanySelect: (company: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  const visibleCompanies = showAll ? companies : companies.slice(0, 10);

  return (
    <Card>
      <CardHeader className="min-h-9 grid-cols-[minmax(0,1fr)_auto] items-center border-b">
        <CardTitle id="company-performance-title" className="flex items-center gap-2">
          <Building2Icon className="text-muted-foreground size-4 shrink-0" aria-hidden />
          Company Performance
        </CardTitle>
        <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
          {formatAnalyticsCompanyCount(companies.length)}
        </span>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full min-w-3xl border-collapse text-left text-xs">
            <caption className="sr-only">
              Company performance showing applications, interviews, offers, interview rate, and latest applied date
            </caption>
            <thead className="bg-muted/70">
              <tr>
                <th scope="col" className="px-3 py-2.5 font-medium">
                  Company
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Applications
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Interviewed
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Offers
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Interview Rate
                </th>
                <th scope="col" className="px-3 py-2.5 text-right font-medium">
                  Latest Applied Date
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleCompanies.map((company) => (
                <tr key={company.company} className="border-t">
                  <th scope="row" className="max-w-64 px-3 py-2.5 font-normal">
                    <button
                      type="button"
                      onClick={() => onCompanySelect(company.company)}
                      className="max-w-full truncate text-left text-blue-600 outline-none hover:text-blue-700 hover:underline focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                      title={`Filter by ${company.company}`}
                    >
                      {company.company}
                    </button>
                  </th>
                  <td className="px-3 py-2.5 text-right tabular-nums">{company.applications}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{company.interviewed}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{company.offers}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatAnalyticsRate(company.interviewRate)}</td>
                  <td className="text-muted-foreground px-3 py-2.5 text-right whitespace-nowrap">
                    {formatAppliedDate(company.latestAppliedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {companies.length > 10 ? (
          <div className="mt-3 flex justify-center">
            <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((current) => !current)}>
              {showAll ? "Show Top 10" : "Show All Companies"}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
