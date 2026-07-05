import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { securityEvidence } from "./security.js";
import type { RepoFile, Target } from "./types.js";

const TOTAL_BUDGET = 20_000;
const SKIP_DIRS = new Set([
  ".git", "node_modules", "dist", "build", ".next", "__pycache__",
  ".venv", "venv", "coverage", ".turbo", "target", "out",
]);
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".rb", ".cs"]);
const MANIFEST_NAMES = ["package.json", "pyproject.toml", "requirements.txt", "Dockerfile", "docker-compose.yml"];

function main(): void {
  const { values } = parseArgs({ options: { repo: { type: "string" } } });
  if (!values.repo) {
    throw new Error(`Usage: npm run collect -- --repo <github-url>`);
  }
  const match = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(values.repo);
  if (!match) {
    throw new Error(`Could not parse a GitHub owner/repo from "${values.repo}".`);
  }
  const [, owner, name] = match;
  const cloneUrl = `https://github.com/${owner}/${name}.git`;

  const tmp = mkdtempSync(join(tmpdir(), "evaluator-collect-"));
  try {
    console.log(`Cloning ${owner}/${name} (shallow)...`);
    execFileSync("git", ["clone", "--depth", "1", "--quiet", cloneUrl, tmp], {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const files = walk(tmp, tmp);
    files.sort((a, b) => a.rel.localeCompare(b.rel));

    const evidence = buildEvidence(tmp, files);
    const target: Target = {
      name: `${owner}/${name}`,
      description: `Open-source GitHub repository at ${cloneUrl.replace(/\.git$/, "")}. ${firstReadmeParagraph(tmp, files)}`.trim(),
      evidence,
    };

    const outPath = join("targets", `repo-${slug(owner)}-${slug(name)}.json`);
    writeFileSync(outPath, JSON.stringify(target, null, 2));
    const totalChars = evidence.reduce((n, e) => n + e.length, 0);
    console.log(`Target written: ${outPath} (${evidence.length} evidence items, ${totalChars} chars)`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function walk(root: string, dir: string): RepoFile[] {
  const out: RepoFile[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) out.push(...walk(root, full));
    } else if (entry.isFile()) {
      out.push({ rel: relative(root, full).replaceAll("\\", "/"), size: statSync(full).size });
    }
  }
  return out;
}

function buildEvidence(root: string, files: RepoFile[]): string[] {
  const evidence: string[] = [];
  const used = new Set<string>();

  evidence.push(repoStats(files));
  evidence.push(fileTree(files));

  const readme = files.find((f) => /^readme\.md$/i.test(f.rel)) ?? files.find((f) => /readme\.md$/i.test(f.rel));
  if (readme) {
    used.add(readme.rel);
    evidence.push(`README excerpt:\n${excerpt(root, readme.rel, 2000)}`);
  }

  const manifests = files
    .filter((f) => MANIFEST_NAMES.includes(basename(f.rel)) || /\.github\/workflows\/.+\.ya?ml$/.test(f.rel))
    .sort((a, b) => depth(a.rel) - depth(b.rel))
    .slice(0, 4);
  for (const m of manifests) {
    used.add(m.rel);
    evidence.push(`Config/manifest ${m.rel}:\n${excerpt(root, m.rel, 600)}`);
  }

  const keySources = files
    .filter((f) => SOURCE_EXTS.has(ext(f.rel)) && !used.has(f.rel))
    .sort((a, b) => {
      const entryA = isEntrypoint(a.rel) ? 0 : 1;
      const entryB = isEntrypoint(b.rel) ? 0 : 1;
      return entryA - entryB || depth(a.rel) - depth(b.rel) || b.size - a.size;
    })
    .slice(0, 3);
  for (const s of keySources) {
    evidence.push(`Source file ${s.rel}:\n${excerpt(root, s.rel, 1200)}`);
  }

  evidence.push(...securityEvidence(root, files));

  // Enforce the total budget so local 8B models can take the whole bundle.
  let total = 0;
  return evidence.map((e) => {
    const remaining = TOTAL_BUDGET - total;
    const kept = remaining <= 0 ? "" : e.length > remaining ? e.slice(0, remaining) + "\n…[truncated]" : e;
    total += kept.length;
    return kept;
  }).filter((e) => e.length > 0);
}

function repoStats(files: RepoFile[]): string {
  const byExt = new Map<string, number>();
  for (const f of files) {
    const e = ext(f.rel);
    if (e) byExt.set(e, (byExt.get(e) ?? 0) + 1);
  }
  const topExts = [...byExt.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([e, n]) => `${e}:${n}`).join(", ");
  const has = (test: (f: RepoFile) => boolean, label: string) =>
    `${label}: ${files.some(test) ? "yes" : "no"}`;
  return [
    `Repo stats: ${files.length} files. Extensions: ${topExts}.`,
    has((f) => /(^|\/)(tests?|__tests__|spec)\//.test(f.rel) || /\.(test|spec)\./.test(f.rel), "tests"),
    has((f) => f.rel.startsWith(".github/workflows/"), "CI workflows"),
    has((f) => /^licen[cs]e/i.test(f.rel), "LICENSE"),
    has((f) => basename(f.rel) === "Dockerfile", "Dockerfile"),
    has((f) => /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|uv\.lock)$/.test(basename(f.rel)), "lockfile"),
  ].join(" ");
}

function fileTree(files: RepoFile[]): string {
  const lines = files.slice(0, 150).map((f) => `${f.rel} (${f.size}b)`);
  const more = files.length > 150 ? `\n…and ${files.length - 150} more files` : "";
  return `File tree:\n${lines.join("\n")}${more}`;
}

function firstReadmeParagraph(root: string, files: RepoFile[]): string {
  const readme = files.find((f) => /^readme\.md$/i.test(f.rel));
  if (!readme) return "";
  const text = readText(root, readme.rel);
  const para = text.split(/\r?\n\r?\n/).map((p) => p.trim())
    .find((p) => p.length > 0 && !p.startsWith("#") && !p.startsWith("!["));
  return (para ?? "").slice(0, 300);
}

function excerpt(root: string, rel: string, max: number): string {
  const text = readText(root, rel);
  return text.length > max ? text.slice(0, max) + "\n…[truncated]" : text;
}

function readText(root: string, rel: string): string {
  return readFileSync(join(root, rel), "utf8").replaceAll("\0", "");
}

function basename(rel: string): string {
  return rel.split("/").pop() ?? rel;
}

function ext(rel: string): string {
  const b = basename(rel);
  const i = b.lastIndexOf(".");
  return i > 0 ? b.slice(i) : "";
}

function depth(rel: string): number {
  return rel.split("/").length;
}

function isEntrypoint(rel: string): boolean {
  return /^(main|index|app|server|cli)\./.test(basename(rel));
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
}

try {
  main();
} catch (err: unknown) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
