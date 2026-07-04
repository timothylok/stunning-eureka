import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { EvaluationRun } from "./types.js";

const REPORTS_DIR = "reports";

export function saveReport(run: EvaluationRun): { jsonPath: string; mdPath: string } {
  mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = run.started_at.replace(/[:.]/g, "-");
  const base = `${slug(run.target)}-${slug(run.model_provider_id)}-${stamp}`;
  const jsonPath = join(REPORTS_DIR, `${base}.json`);
  const mdPath = join(REPORTS_DIR, `${base}.md`);

  writeFileSync(jsonPath, JSON.stringify(run, null, 2));
  writeFileSync(mdPath, renderMarkdown(run));
  return { jsonPath, mdPath };
}

function renderMarkdown(run: EvaluationRun): string {
  const r = run.result;
  const lines = [
    `# Evaluation: ${run.target}`,
    ``,
    `- **Model:** ${run.model_provider_id} (${run.model_name})`,
    `- **Rubric:** ${run.rubric}`,
    `- **Date:** ${run.started_at}`,
    `- **Latency:** ${run.latency_ms} ms`,
    run.token_usage
      ? `- **Tokens:** ${run.token_usage.prompt} prompt / ${run.token_usage.completion} completion`
      : ``,
    ``,
    `## Overall`,
    r.overall_rating,
    ``,
    `## Scores`,
    ...Object.entries(r.scores).map(([id, score]) => `- **${id}:** ${score}`),
    ``,
    `## Strengths`,
    ...bullets(r.strengths),
    ``,
    `## Weaknesses`,
    ...bullets(r.weaknesses),
    ``,
    `## Recommendations`,
    ...bullets(r.recommendations),
    ``,
    `## Risk flags`,
    ...bullets(r.risk_flags),
  ];
  return lines.filter((l) => l !== undefined).join("\n") + "\n";
}

function bullets(items: string[]): string[] {
  return items.length ? items.map((s) => `- ${s}`) : ["- (none)"];
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
