import type { EvaluationPrompt, Rubric, Target } from "./types.js";

const OUTPUT_SCHEMA = `{
  "scores": { "<criterion_id>": <number> },
  "overall_rating": "<one-line verdict>",
  "strengths": ["<string>"],
  "weaknesses": ["<string>"],
  "recommendations": ["<string>"],
  "risk_flags": ["<string>"]
}`;

export function buildPrompt(target: Target, rubric: Rubric): EvaluationPrompt {
  const system =
    "You are an autonomous evaluator. Follow the rubric strictly. " +
    "Base your judgement only on the target description and evidence provided. " +
    "Output valid JSON only, matching the given schema exactly — no prose outside the JSON.";

  const user = [
    `# Target\nName: ${target.name}\nDescription: ${target.description}`,
    `# Evidence\n${target.evidence.map((e, i) => `${i + 1}. ${e}`).join("\n")}`,
    `# Rubric (score each criterion from ${rubric.scale.min} to ${rubric.scale.max})\n${JSON.stringify(rubric, null, 2)}`,
    `# Required output schema\nThe "scores" object must contain exactly one numeric entry per rubric criterion id.\n${OUTPUT_SCHEMA}`,
  ].join("\n\n");

  return { system, user };
}
