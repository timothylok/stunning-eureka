import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import { readJson, runEvaluation } from "./evaluate.js";
import type { ModelsFile, Target } from "./types.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      target: { type: "string", default: "targets/example.json" },
      rubric: { type: "string", default: "rubrics/default.json" },
      model: { type: "string" },
    },
  });

  const modelId = values.model ?? readJson<ModelsFile>("models.json").default;
  const targetName = readJson<Target>(values.target).name;
  console.log(`Evaluating "${targetName}" with ${modelId}...`);

  const { run, jsonPath, mdPath } = await runEvaluation(values.target, values.rubric, modelId);

  console.log(`Overall: ${run.result.overall_rating}`);
  for (const [id, score] of Object.entries(run.result.scores)) {
    console.log(`  ${id}: ${score}`);
  }
  console.log(`Report saved: ${jsonPath}, ${mdPath} (${run.latency_ms} ms)`);
}

main().catch((err: unknown) => {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
