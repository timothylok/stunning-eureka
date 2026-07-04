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
- Next: enable claude/gpt providers when keys are available; possibly multi-target support.
