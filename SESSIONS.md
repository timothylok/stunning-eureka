# Session Log

## 2026-07-05
- Filled in CLAUDE.md: memory paths, session log path, project-specific context (section 10).
- Built the runnable prototype of the model-agnostic AI evaluator: Model Provider Layer (Ollama live; anthropic/openai/google stubbed), universal prompt builder, JSON validation engine, report store, CLI entry.
- Verified end-to-end with llama3.1:8b and mistral:7b against the example target; negative checks (unknown/disabled model) produce clean errors.
- Next: wire up a cloud provider (Anthropic first), add a model comparison/diff view across reports, then a minimal web UI with model selector.
- (Later same day) Wired the Anthropic provider via raw fetch (claude-opus-4-8, no sampling params, refusal handling); stays disabled until ANTHROPIC_API_KEY is set — missing-key error path verified. Added `npm run compare`: cross-model table per target from saved reports, verified against llama3.1 vs mistral.
- Added the OpenAI-compatible provider and pointed an `agnes` model at Agnes AI (agnes-2.0-flash, apihub.agnes-ai.com/v1, Bearer auth via AGNES_API_KEY). CLI now loads `.env` (Node built-in, gitignored); placeholder `.env` created.
- Verified Agnes AI live (3.8s evaluation, valid scores); three-way comparison now spans agnes/llama3.1/mistral.
- Built the web UI: `npm run web` serves web/index.html via node:http (src/server.ts) with /api/config, /api/evaluate, /api/reports; extracted shared runEvaluation into src/evaluate.ts. Verified in Chrome: model selector, live run with agnes, result card with box-meter scores, comparison matrix.
- Repo evaluation: added src/collect.ts (shallow-clone a GitHub repo, distill stats/tree/README/manifests/key sources into a ≤20K-char evidence bundle, write an ordinary target file) and rubrics/repo-quality.json (7 weighted criteria, 1–10 scale). Runs now carry the rubric scale so UI meters render 10-box scales; markdown reports show a weighted composite. Verified end-to-end on timothylok/databricks_stock_sentiment with agnes + llama3.1, CLI compare, and a UI run.
- Added web/help.html user guide (all CLI commands, web UI, models.json config, targets/rubrics/reports schemas, env vars, troubleshooting); served at /help with a header link from the UI.
- Added ANTHROPIC_API_KEY= placeholder to .env — once the user pastes the key, flip claude to enabled:true in models.json and verify live.
- Claude key added; wiring verified live but the Anthropic account has no API credits (clean 400 billing error). claude stays enabled — works as soon as credits are added.
- Security scanning: src/security.ts (7 static indicator categories: install hooks, obfuscation, network, file ops, cron, docker, dependencies) feeds collector evidence; rubrics/security.json (8 weighted criteria, 1–10, 10 = safest, findings → risk_flags). Verified on databricks_stock_sentiment (agnes 9-10s composite ~9.5, llama3.1 stricter on network-activity 6) and self-test on stunning-eureka (all 10s except network 9 — flagged the Agnes AI domain, correctly explained by docs). Chrome tab froze during final UI check (browser-side); verified via fresh tab render + direct POST to /api/evaluate instead.
- Next: enable gpt/gemini when keys are available; candidate features: run-diff view, radar chart comparison. Uncommitted work since 30b81f7 — commit when asked.
