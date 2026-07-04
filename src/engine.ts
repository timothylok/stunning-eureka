import type { EvaluationResult, Rubric } from "./types.js";

const ARRAY_KEYS = ["strengths", "weaknesses", "recommendations", "risk_flags"] as const;

export function parseEvaluation(raw: string, rubric: Rubric): EvaluationResult {
  const parsed = parseJson(raw);

  const scores = parsed["scores"];
  if (typeof scores !== "object" || scores === null || Array.isArray(scores)) {
    throw new Error(`Model output is missing a "scores" object.`);
  }
  for (const criterion of rubric.criteria) {
    const value = (scores as Record<string, unknown>)[criterion.id];
    if (typeof value !== "number" || value < rubric.scale.min || value > rubric.scale.max) {
      throw new Error(
        `Score for "${criterion.id}" is missing or outside ${rubric.scale.min}-${rubric.scale.max}: ${JSON.stringify(value)}`,
      );
    }
  }

  if (typeof parsed["overall_rating"] !== "string") {
    throw new Error(`Model output is missing an "overall_rating" string.`);
  }
  for (const key of ARRAY_KEYS) {
    if (!Array.isArray(parsed[key])) {
      throw new Error(`Model output is missing a "${key}" array.`);
    }
  }

  return parsed as unknown as EvaluationResult;
}

function parseJson(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw);
  } catch {
    // Salvage the outermost {...} block from noisy output.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error(`Model output is not JSON:\n${raw}`);
    }
    return JSON.parse(raw.slice(start, end + 1));
  }
}
