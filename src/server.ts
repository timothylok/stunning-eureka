import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { join } from "node:path";
import { readJson, runEvaluation } from "./evaluate.js";
import type { EvaluationRun, ModelsFile } from "./types.js";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const PORT = Number(process.env.PORT ?? 3000);

const server = createServer((req, res) => {
  handle(req, res).catch((err: unknown) => {
    sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
  });
});

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(readFileSync("web/index.html"));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    const modelsFile = readJson<ModelsFile>("models.json");
    sendJson(res, 200, {
      default: modelsFile.default,
      models: Object.entries(modelsFile.models).map(([id, m]) => ({
        id,
        model_name: m.model_name,
        type: m.type,
        enabled: m.enabled,
      })),
      targets: listJsonFiles("targets"),
      rubrics: listJsonFiles("rubrics"),
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/reports") {
    sendJson(res, 200, loadRuns());
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/evaluate") {
    const body = JSON.parse(await readBody(req)) as {
      model?: string;
      target?: string;
      rubric?: string;
    };
    // Filenames come from the browser — only accept ones that exist in the
    // corresponding directory (no paths).
    const target = requireListed("targets", body.target ?? "example.json");
    const rubric = requireListed("rubrics", body.rubric ?? "default.json");
    const { run } = await runEvaluation(target, rubric, body.model);
    sendJson(res, 200, run);
    return;
  }

  sendJson(res, 404, { error: `Not found: ${req.method} ${url.pathname}` });
}

function listJsonFiles(dir: string): string[] {
  return readdirSync(dir).filter((f) => f.endsWith(".json"));
}

function requireListed(dir: string, filename: string): string {
  if (!listJsonFiles(dir).includes(filename)) {
    throw new Error(`Unknown ${dir.slice(0, -1)} "${filename}".`);
  }
  return join(dir, filename);
}

function loadRuns(): EvaluationRun[] {
  if (!existsSync("reports")) return [];
  return readdirSync("reports")
    .filter((f) => f.endsWith(".json") && !f.startsWith("compare-"))
    .map((f) => readJson<EvaluationRun>(join("reports", f)));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk: Buffer) => (data += chunk.toString()));
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

server.listen(PORT, () => {
  console.log(`AI Tools Evaluator UI: http://localhost:${PORT}`);
});
