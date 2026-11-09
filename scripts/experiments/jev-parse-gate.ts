/**
 * Experiment: can Jev (TypeSafe System One) catch bad parse output?
 *
 * Reads real applications from the local SQLite DB (read-only), adds synthetic
 * corruptions based on known parser failure classes, asks Jev three Noul questions
 * per record, and scores the answers against rule-based labels.
 *
 *   pnpm exec tsx scripts/experiments/jev-parse-gate.ts [--limit N] [--seed N]
 *
 * Needs TYPESAFE_API_KEY. Writes raw results to the OS temp dir (path printed at the end).
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { collapseWhitespace } from "@/lib/collapseWhitespace";
import { normalizeJobTitle } from "@/lib/normalizeJobTitle";

const ENDPOINT = "https://api.typesafe.ai/v1/systemone";
const JEV_MODEL = "jev-latest";
const CONCURRENCY = 8;

const BOARDS = ["Ashby", "Paraform", "Y Combinator", "LinkedIn", "Greenhouse", "Lever", "Simplify"];
const GENERIC_TITLES = [
  "Jobs",
  "Careers",
  "Job Application",
  "Open Positions",
  "Apply Now",
  "Careers detail | Acme.io",
];
const BOARD_SET = new Set(BOARDS.map((b) => b.toLowerCase()));
const GENERIC_RE = /^(careers|jobs?|job application|open positions|apply now)\b/i;

type Source = "real" | "suffix" | "board" | "generic";
type Record = {
  id: string;
  source: Source;
  title: string;
  company: string;
  host: string;
  truth: { cleanTitle: boolean; employer: boolean; role: boolean };
};
type TruthKey = keyof Record["truth"];
type QuestionKey = TruthKey | "employerHint" | "employerKind";
const TRUTH_OF: Record_<QuestionKey, TruthKey> = {
  cleanTitle: "cleanTitle",
  employer: "employer",
  role: "role",
  employerHint: "employer",
  employerKind: "employer",
};
type QuestionDef =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record_<string, string> };
type Scored = Record & { p: Partial<Record_<QuestionKey, number>>; ms: number; inTok: number; outTok: number };
type Record_<K extends string, V> = { [P in K]: V };

const QUESTIONS: Record_<QuestionKey, QuestionDef> = {
  cleanTitle: {
    type: "noul",
    instructions:
      "`title` contains only the name of the job role. It does not include the employer's name, a job board or website name, or a page-title suffix such as '| Y Combinator'.",
  },
  employer: {
    type: "noul",
    instructions:
      "`company` is the name of the organization that is hiring for the role. It is not a job board, applicant tracking system, recruiting marketplace, or social network.",
  },
  employerHint: {
    type: "noul",
    instructions:
      "`company` is the name of the organization that is hiring for the role. Job boards, applicant tracking systems and aggregators (for example Ashby, Greenhouse, Lever, Workable, LinkedIn, Y Combinator, Simplify, Paraform) are not hiring organizations.",
  },
  employerKind: {
    type: "choice",
    instructions: "What kind of organization is `company`, given the job title and source_host?",
    criteria: {
      employer: "A company or organization that hires employees for this role.",
      job_board_or_ats:
        "A job board, applicant tracking system, recruiting marketplace, aggregator, or social network that hosts postings for other companies.",
      other: "Something else, or not an organization name.",
    },
  },
  role: {
    type: "noul",
    instructions:
      "`title` names a specific job role someone could be hired for, not a generic page title such as 'Careers' or 'Jobs'.",
  },
};

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function loadRows(): Array<{ id: string; title: string; company: string; url: string }> {
  const out = execFileSync(
    "sqlite3",
    [
      "-readonly",
      "-json",
      "data/applied.db",
      "select id, title, company, url from applications where title is not null and company is not null",
    ],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return JSON.parse(out) as Array<{ id: string; title: string; company: string; url: string }>;
}

function buildRecords(seed: number, syntheticCount: number): Record[] {
  const rand = rng(seed);
  const rows = loadRows();
  const records: Record[] = rows.map((r) => ({
    id: r.id,
    source: "real",
    title: r.title,
    company: r.company,
    host: hostOf(r.url),
    truth: {
      cleanTitle: collapseWhitespace(r.title) === normalizeJobTitle(r.title) && !/\s[|@]\s/.test(r.title),
      employer: !BOARD_SET.has(r.company.toLowerCase()),
      role: !GENERIC_RE.test(r.title),
    },
  }));

  const clean = records.filter((r) => r.truth.cleanTitle && r.truth.employer && r.truth.role);
  const pick = (): Record => clean[Math.floor(rand() * clean.length)];
  const choose = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

  for (let i = 0; i < syntheticCount; i++) {
    const a = pick();
    const suffix = choose([
      " | Y Combinator",
      " | Simplify",
      ` at ${a.company}`,
      ` @ ${a.company}`,
      ` | ${a.company} Careers`,
    ]);
    records.push({
      ...a,
      id: `${a.id}:suffix:${i}`,
      source: "suffix",
      title: a.title + suffix,
      truth: { ...a.truth, cleanTitle: false },
    });
    const b = pick();
    records.push({
      ...b,
      id: `${b.id}:board:${i}`,
      source: "board",
      company: choose(BOARDS),
      truth: { ...b.truth, employer: false },
    });
    const c = pick();
    records.push({
      ...c,
      id: `${c.id}:generic:${i}`,
      source: "generic",
      title: choose(GENERIC_TITLES),
      truth: { ...c.truth, role: false, cleanTitle: true },
    });
  }
  return records;
}

type NoulAnswer = { noul?: number; probabilities?: Record_<string, number> };
type Response = {
  answers: Record_<QuestionKey, NoulAnswer>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

async function ask(record: Record, apiKey: string): Promise<Scored> {
  const body = JSON.stringify({
    model: JEV_MODEL,
    state: { title: record.title, company: record.company, source_host: record.host },
    questions: QUESTIONS,
  });
  for (let attempt = 0; attempt < 5; attempt++) {
    const started = performance.now();
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(30000),
    });
    const ms = performance.now() - started;
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`Jev ${res.status}: ${await res.text()}`);
    const json = (await res.json()) as Response;
    return {
      ...record,
      p: {
        cleanTitle: json.answers.cleanTitle.noul,
        employer: json.answers.employer.noul,
        role: json.answers.role.noul,
        employerHint: json.answers.employerHint.noul,
        employerKind: json.answers.employerKind.probabilities?.employer,
      },
      ms,
      inTok: json.usage?.input_tokens ?? 0,
      outTok: json.usage?.output_tokens ?? 0,
    };
  }
  throw new Error("Jev: retries exhausted");
}

async function pool<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: n }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}

function auc(scores: Array<{ p: number; positive: boolean }>): number {
  const pos = scores.filter((s) => s.positive);
  const neg = scores.filter((s) => !s.positive);
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  for (const a of pos) for (const b of neg) wins += a.p > b.p ? 1 : a.p === b.p ? 0.5 : 0;
  return wins / (pos.length * neg.length);
}

function report(results: Scored[]): void {
  const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;
  for (const key of Object.keys(QUESTIONS) as QuestionKey[]) {
    const rows = results
      .filter((r) => !(key === "cleanTitle" && r.source === "generic")) // generic rows have no cleanTitle label
      .map((r) => ({ r, p: r.p[key]!, truth: r.truth[TRUTH_OF[key]] }));
    const correct = rows.filter((x) => x.p >= 0.5 === x.truth);
    const confident = rows.filter((x) => x.p <= 0.2 || x.p >= 0.8);
    const confidentOk = confident.filter((x) => x.p >= 0.5 === x.truth);
    const bad = rows.filter((x) => !x.truth);
    const caught = bad.filter((x) => x.p < 0.5);
    const flagged = rows.filter((x) => x.p < 0.5);
    console.log(`\n=== ${key}  (true = good) ===`);
    console.log(
      `n=${rows.length}  bad-class=${bad.length}  accuracy@0.5=${pct(correct.length / rows.length)}  AUC=${auc(rows.map((x) => ({ p: x.p, positive: x.truth }))).toFixed(3)}`,
    );
    console.log(
      `bad caught (recall)=${pct(caught.length / (bad.length || 1))}  precision of flags=${pct(flagged.length ? flagged.filter((x) => !x.truth).length / flagged.length : NaN)}`,
    );
    console.log(
      `confident (<=0.2 or >=0.8)=${pct(confident.length / rows.length)} of rows, accuracy there=${pct(confidentOk.length / (confident.length || 1))}`,
    );
    for (const source of ["real", "suffix", "board", "generic"] as Source[]) {
      const subset = rows.filter((x) => x.r.source === source);
      if (!subset.length) continue;
      const ok = subset.filter((x) => x.p >= 0.5 === x.truth).length;
      console.log(`  ${source.padEnd(8)} n=${String(subset.length).padStart(3)}  accuracy=${pct(ok / subset.length)}`);
    }
    const wrong = rows
      .filter((x) => x.p >= 0.5 !== x.truth)
      .sort((a, b) => Math.abs(b.p - 0.5) - Math.abs(a.p - 0.5))
      .slice(0, 8);
    for (const x of wrong)
      console.log(`  MISS p=${x.p.toFixed(2)} truth=${x.truth} [${x.r.source}] ${x.r.title} | ${x.r.company}`);
  }
  const ms = results.map((r) => r.ms).sort((a, b) => a - b);
  const tokens = results.reduce((s, r) => s + r.inTok + r.outTok, 0);
  console.log(
    `\nlatency per request: median=${ms[Math.floor(ms.length / 2)].toFixed(0)}ms p95=${ms[Math.floor(ms.length * 0.95)].toFixed(0)}ms  requests=${results.length}  tokens=${tokens}  est. cost@$42/M input=$${((results.reduce((s, r) => s + r.inTok, 0) * 42) / 1e9).toFixed(4)}`,
  );
}

async function main(): Promise<void> {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new Error("TYPESAFE_API_KEY is not set");
  const records = buildRecords(arg("seed", 1), arg("limit", 120));
  const counts = records.reduce<Record_<string, number>>((m, r) => ({ ...m, [r.source]: (m[r.source] ?? 0) + 1 }), {});
  console.log(`records: ${JSON.stringify(counts)}`);
  const results = await pool(records, CONCURRENCY, (r) => ask(r, apiKey));
  const outPath = join(tmpdir(), "jev-parse-gate.json");
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  report(results);
  console.log(`raw results: ${outPath}`);
}

void main();
