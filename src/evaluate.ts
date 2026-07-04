import { readFileSync } from "node:fs";
import { parseEvaluation } from "./engine.js";
import { buildPrompt } from "./prompt.js";
import { createProvider } from "./providers/registry.js";
import { saveReport } from "./report.js";
import type { EvaluationRun, ModelsFile, Rubric, Target } from "./types.js";

export interface EvaluationOutcome {
  run: EvaluationRun;
  jsonPath: string;
  mdPath: string;
}

export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export async function runEvaluation(
  targetPath: string,
  rubricPath: string,
  modelId?: string,
): Promise<EvaluationOutcome> {
  const modelsFile = readJson<ModelsFile>("models.json");
  const id = modelId ?? modelsFile.default;
  const modelConfig = modelsFile.models[id];
  if (!modelConfig) {
    throw new Error(
      `Unknown model "${id}". Available: ${Object.keys(modelsFile.models).join(", ")}`,
    );
  }
  if (!modelConfig.enabled) {
    throw new Error(`Model "${id}" is disabled in models.json.`);
  }

  const target = readJson<Target>(targetPath);
  const rubric = readJson<Rubric>(rubricPath);

  const provider = createProvider(modelConfig);
  const prompt = buildPrompt(target, rubric);

  const startedAt = new Date();
  const response = await provider.evaluate(prompt);
  const latencyMs = Date.now() - startedAt.getTime();

  const result = parseEvaluation(response.text, rubric);

  const run: EvaluationRun = {
    target: target.name,
    rubric: rubric.name,
    model_provider_id: id,
    model_name: modelConfig.model_name,
    started_at: startedAt.toISOString(),
    latency_ms: latencyMs,
    token_usage: response.token_usage,
    result,
  };

  const { jsonPath, mdPath } = saveReport(run);
  return { run, jsonPath, mdPath };
}
