import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { EvaluationRun } from "./types.js";

const REPORTS_DIR = "reports";

function main(): void {
  const { values } = parseArgs({
    options: { target: { type: "string" } },
  });

  const runs = loadRuns();
  if (runs.length === 0) {
    throw new Error(`No reports found in ${REPORTS_DIR}\\. Run an evaluation first.`);
  }

  const targets = [...new Set(runs.map((r) => r.target))];
  const target = values.target ?? (targets.length === 1 ? targets[0] : undefined);
  if (!target) {
    throw new Error(`Multiple targets found — pass --target. Available: ${targets.join(", ")}`);
  }

  // Latest run per model for the chosen target.
  const latestByModel = new Map<string, EvaluationRun>();
  for (const run of runs.filter((r) => r.target === target)) {
    const existing = latestByModel.get(run.model_provider_id);
    if (!existing || run.started_at > existing.started_at) {
      latestByModel.set(run.model_provider_id, run);
    }
  }
  if (latestByModel.size < 2) {
    throw new Error(
      `Need reports from at least 2 models for "${target}" to compare (found ${latestByModel.size}).`,
    );
  }

  const md = renderComparison(target, [...latestByModel.values()]);
  console.log(md);
  const outPath = join(REPORTS_DIR, `compare-${slug(target)}.md`);
  writeFileSync(outPath, md);
  console.log(`Comparison saved: ${outPath}`);
}

function loadRuns(): EvaluationRun[] {
  let files: string[];
  try {
    files = readdirSync(REPORTS_DIR).filter(
      (f) => f.endsWith(".json") && !f.startsWith("compare-"),
    );
  } catch {
    return [];
  }
  return files.map((f) => JSON.parse(readFileSync(join(REPORTS_DIR, f), "utf8")) as EvaluationRun);
}

function renderComparison(target: string, runs: EvaluationRun[]): string {
  const criteria = [...new Set(runs.flatMap((r) => Object.keys(r.result.scores)))];
  const header = `| | ${runs.map((r) => `**${r.model_provider_id}**`).join(" | ")} |`;
  const divider = `|---|${runs.map(() => "---|").join("")}`;

  const rows = [
    ...criteria.map(
      (c) => `| ${c} | ${runs.map((r) => r.result.scores[c] ?? "—").join(" | ")} |`,
    ),
    `| overall | ${runs.map((r) => r.result.overall_rating).join(" | ")} |`,
    `| latency | ${runs.map((r) => `${r.latency_ms} ms`).join(" | ")} |`,
    `| tokens (in/out) | ${runs
      .map((r) => (r.token_usage ? `${r.token_usage.prompt}/${r.token_usage.completion}` : "—"))
      .join(" | ")} |`,
    `| run date | ${runs.map((r) => r.started_at.slice(0, 10)).join(" | ")} |`,
  ];

  return [`# Model comparison: ${target}`, "", header, divider, ...rows, ""].join("\n");
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

try {
  main();
} catch (err: unknown) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
