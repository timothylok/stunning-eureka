# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Copy this file into any new project and fill in the project-specific sections marked with `[FILL IN]`.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.
- For exploratory questions ("what could we do about X?"), respond in 2–3 sentences with a recommendation and the main tradeoff. Don't implement until the user agrees.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan before starting:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Safety & Security

**Never introduce vulnerabilities. Never take irreversible actions silently.**

Code safety:
- Never introduce SQL injection, command injection, XSS, path traversal, or hardcoded secrets.
- Validate only at system boundaries (user input, external APIs). Trust internal code.
- Never commit `.env`, credentials, or API keys. Warn the user if they try to.

Destructive action guard — pause and confirm before any action that is:
- Hard to reverse: `git reset --hard`, force-push, dropping tables, deleting files.
- Visible to others: pushing code, opening/closing PRs, sending messages.
- Affecting shared state: CI/CD changes, infrastructure modifications, shared config.

One user approval does not authorize the same action in all future contexts. Confirm each time unless the user has explicitly pre-authorized it in this file.

## 6. Dependency & File Discipline

**Don't add weight without a reason.**

- Don't add a new package if the standard library or an already-imported dependency covers it.
- When adding a dependency, name it and state why the existing stack doesn't cover it.
- Prefer editing existing files over creating new ones.
- Never create documentation files (`.md`, `README`) or test scaffolding unless explicitly asked.
- Don't create planning or analysis documents — work from conversation context.

## 7. Git Discipline

**Commits are intentional. Branches are sacred.**

- Never commit unless the user explicitly asks.
- Never amend a published commit — create a new one instead.
- Never skip hooks (`--no-verify`) or bypass signing unless the user explicitly instructs it.
- Never force-push to `main`/`master` — warn the user if they request it.
- Commit messages: one line, imperative mood, explain *why* not *what*.

## 8. Response Style

**Terse and precise. No filler.**

- No emoji unless the user asks for them.
- No trailing summaries of what you just did — the user can read the diff.
- One sentence per update while working. Silent is not acceptable; verbose is.
- When referencing code, include `file_path:line_number` so the user can navigate directly.
- End-of-turn: one or two sentences — what changed and what's next. Nothing else.

---

## 9. Project Memory

**Read memory first. Keep it current. Don't let it go stale.**

### Where memory lives

This project's memory file is at:
```
C:\Users\timlo\.claude\projects\D--ai-ai-tools-evaluator\memory\
```

The memory index is at:
```
C:\Users\timlo\.claude\projects\D--ai-ai-tools-evaluator\memory\MEMORY.md
```

### When to read memory

When asked to assess, explain, or verify anything about this project — architecture, pipeline behaviour, scheduling, data flow — **read the memory file first**. Only go to source files if memory is silent or ambiguous.

### When to update memory

At the end of any session where significant changes were made, update the memory file when:
- Architecture changes
- New phases or milestones complete
- Pipeline or scheduler changes
- New canonical file locations are established
- Key decisions are made that aren't obvious from the code

### Project-specific session log

At the end of each session, manually append an entry to `D:\ai\ai-tools-evaluator\SESSIONS.md`:

```
## YYYY-MM-DD
- What was done
- What changed
- What's next
```

No script — this is a manual step. There is no automation that writes entries.

### Source of truth hierarchy

```
Memory file  >  Source code  >  Generated artifacts (HTML, reports, cached output)
```

Never read generated artifacts (HTML, compiled output, cached reports) for project context — they are human-readable outputs, not authoritative state.

---

## 10. Project-Specific Context

This project is a **model-agnostic autonomous AI evaluator**: given a target (an AI tool description + evidence) and a rubric, an LLM scores the target and produces a structured report. A Model Provider Layer keeps evaluator logic independent of any vendor.

### Stack

- Node 22 + TypeScript (run via `tsx`, no build step; `type: module`, NodeNext resolution)
- Zero runtime dependencies — built-in `fetch` talks to the Ollama API directly
- Local models via Ollama; Anthropic wired up via raw fetch (needs `ANTHROPIC_API_KEY`, disabled by default); OpenAI-compatible provider covers Agnes AI (`agnes-2.0-flash` via apihub.agnes-ai.com) and OpenAI; google is a registry stub
- `.env` at project root (gitignored) is loaded by the CLI via Node's `process.loadEnvFile()`

### Key files and entry points

- `src/index.ts` — CLI entry (`npm run evaluate -- --target <file> --rubric <file> --model <id>`)
- `src/providers/` — Model Provider Layer (`provider.ts` interface, `ollama.ts` + `anthropic.ts` impls, `registry.ts` switch)
- `src/compare.ts` — cross-model comparison (`npm run compare -- --target <name>`; reads `reports/*.json`)
- `src/evaluate.ts` — shared `runEvaluation()` used by CLI and server
- `src/collect.ts` — GitHub repo evidence collector (`npm run collect -- --repo <url>` → shallow clone → compact evidence bundle ≤20K chars → `targets/repo-<owner>-<name>.json`)
- `rubrics/repo-quality.json` — weighted 1–10 rubric for repos (correctness, reliability, safety, observability, architecture, devex, docs)
- `src/security.ts` — static security scanner (7 indicator categories) feeding collector evidence; `rubrics/security.json` — weighted 1–10 malware-risk rubric (10 = safest)
- `src/server.ts` + `web/index.html` — web UI (`npm run web`, http://localhost:3000)
- `src/prompt.ts` — universal, provider-independent evaluation prompt builder
- `src/engine.ts` — parses/validates model output JSON against the rubric
- `src/report.ts` — writes reports to `reports/` (JSON + markdown)
- `models.json` — model registry (id → provider type, model name, temperature, enabled flag)
- `rubrics/`, `targets/` — input files; `reports/` — generated output (gitignored)

### Environment variables

- `OLLAMA_HOST` — optional; Ollama endpoint, defaults to `http://localhost:11434`. A scheme-less value (e.g. `127.0.0.1:11434`) is accepted, matching Ollama's own convention.
- `AGNES_API_KEY` — required for the `agnes` model (Agnes AI); put it in `.env`.
- `ANTHROPIC_API_KEY` — required only for the `claude` model (set `enabled: true` in `models.json` once available).
- `ANTHROPIC_BASE_URL` — optional; defaults to `https://api.anthropic.com`.
- Per-model overrides in `models.json`: `base_url` and `api_key_env` for OpenAI-compatible hosts.

### Architecture / data flow

```
target.json + rubric.json → prompt builder → model provider (Ollama) → engine (parse/validate JSON) → report store (reports/*.json + *.md)
```

Each run records model id/name, latency, and token usage in the report, enabling future cross-model comparison.

---

## 11. Lessons Learned

Generalized patterns from past mistakes — apply these proactively.

| Lesson | Pattern | How to avoid |
|--------|---------|--------------|
| Memory before files | Inspected source before checking memory; found contradictory state | Always read memory file first for context on established architecture |
| Stop hooks don't write entries | Assumed automation handled session log; log went stale | Manually add log entries before running any regeneration script |
| Confirmation scope | User approved an action once; assumed blanket approval | Re-confirm destructive or shared-state actions each session unless pre-authorized in this file |
| Speculative error handling | Added validation for states that can't occur internally | Only validate at true system boundaries; trust internal invariants |
| Silent interpretation | Picked one of two interpretations and implemented without asking | Surface ambiguity before touching code |

---

**These guidelines are working if:** diffs contain fewer unnecessary changes, rewrites due to overcomplication decrease, and clarifying questions arrive before mistakes rather than after.
