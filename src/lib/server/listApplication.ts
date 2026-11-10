import type { JobApplication } from "@/types";

/** List payloads omit the (large) parsed job description; clients fetch it per application. */
export function omitFullJd(application: JobApplication): JobApplication {
  const copy = { ...application };
  delete copy.fullJd;
  return copy;
}
