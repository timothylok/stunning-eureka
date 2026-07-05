import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RepoFile } from "./types.js";

const CATEGORY_CAP = 600;
const MAX_SCAN_SIZE = 200_000;
const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".go", ".rs", ".java", ".rb", ".cs",
  ".sh", ".ps1", ".bat", ".cmd", ".json", ".yml", ".yaml", ".toml", ".cfg", ".ini", ".md", ".txt",
]);
const LOCKFILE_RE = /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|poetry\.lock|uv\.lock|Cargo\.lock)$/;

interface ScannedFile {
  rel: string;
  lines: string[];
}

// Static heuristics only: no code execution, no CVE database. Findings are
// indicators for the evaluating model to weigh, not verdicts.
export function securityEvidence(root: string, files: RepoFile[]): string[] {
  const scanned: ScannedFile[] = [];
  for (const f of files) {
    const base = f.rel.split("/").pop() ?? f.rel;
    const dot = base.lastIndexOf(".");
    const extension = dot > 0 ? base.slice(dot) : "";
    const noExtAllowed = ["Dockerfile", "Makefile", "crontab"].includes(base);
    if (f.size > MAX_SCAN_SIZE || LOCKFILE_RE.test(base)) continue;
    if (!TEXT_EXTS.has(extension) && !noExtAllowed) continue;
    try {
      scanned.push({ rel: f.rel, lines: readFileSync(join(root, f.rel), "utf8").split(/\r?\n/) });
    } catch {
      // unreadable file — skip
    }
  }

  return [
    category("install hooks", scanInstallHooks(scanned)),
    category("obfuscation", scanObfuscation(scanned)),
    category("network activity", scanNetwork(scanned)),
    category("dangerous file operations", scanFileOps(scanned)),
    category("cron/scheduled tasks", scanCron(scanned)),
    category("Dockerfile/container risks", scanDocker(scanned)),
    category("declared dependencies", scanDependencies(scanned)),
  ];
}

function category(name: string, findings: string[]): string {
  const body = findings.length ? findings.join("\n") : "no indicators found";
  const capped = body.length > CATEGORY_CAP ? body.slice(0, CATEGORY_CAP) + "\n…[truncated]" : body;
  return `Security scan — ${name}:\n${capped}`;
}

function grep(files: ScannedFile[], pattern: RegExp, label: (line: string) => string,
  fileFilter?: (rel: string) => boolean): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (fileFilter && !fileFilter(f.rel)) continue;
    f.lines.forEach((line, i) => {
      if (pattern.test(line)) out.push(`${f.rel}:${i + 1}: ${label(line.trim().slice(0, 120))}`);
    });
  }
  return out;
}

function scanInstallHooks(files: ScannedFile[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.rel.endsWith("package.json")) {
      try {
        const scripts = (JSON.parse(f.lines.join("\n")) as { scripts?: Record<string, string> }).scripts ?? {};
        for (const hook of ["preinstall", "postinstall", "prepare", "prepublish"]) {
          if (scripts[hook]) out.push(`${f.rel}: "${hook}": "${scripts[hook].slice(0, 100)}"`);
        }
      } catch { /* unparseable json — ignore */ }
    }
  }
  out.push(...grep(files, /cmdclass\s*=/, (l) => `custom setup command: ${l}`, (r) => r.endsWith("setup.py")));
  out.push(...grep(files, /(curl|wget)[^|\n]*\|\s*(sh|bash)/, (l) => `remote script pipe: ${l}`,
    (r) => /(^|\/)Makefile$/.test(r)));
  return out;
}

function scanObfuscation(files: ScannedFile[]): string[] {
  const isSource = (r: string) => /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|sh|ps1)$/.test(r);
  return [
    ...grep(files, /\beval\s*\(/, () => "eval() call", isSource),
    ...grep(files, /\bexec\s*\(\s*["'`]/, () => "exec() of string literal", isSource),
    ...grep(files, /new\s+Function\s*\(/, () => "dynamic Function() constructor", isSource),
    ...grep(files, /\batob\s*\(|fromCharCode/, () => "string-decoding pattern", isSource),
    ...grep(files, /[A-Za-z0-9+/]{120,}={0,2}/, () => "long base64-like blob", isSource),
    ...grep(files, /(?:\\x[0-9a-fA-F]{2}){20,}/, () => "long hex-escaped blob", isSource),
  ];
}

function scanNetwork(files: ScannedFile[]): string[] {
  const out: string[] = [];
  const domains = new Set<string>();
  const urlRe = /https?:\/\/([^\s"'`)>\]/]+)/g;
  for (const f of files) {
    f.lines.forEach((line, i) => {
      for (const m of line.matchAll(urlRe)) {
        const host = m[1].toLowerCase();
        domains.add(host);
        if (/^\d{1,3}(\.\d{1,3}){3}(:\d+)?$/.test(host)) {
          out.push(`${f.rel}:${i + 1}: raw IP-literal URL (${host})`);
        }
      }
      if (/https?:\/\//.test(line) && /\b(POST|PUT)\b|method:\s*["'](post|put)/i.test(line)) {
        out.push(`${f.rel}:${i + 1}: outbound ${/put/i.test(line) ? "PUT" : "POST"} with hardcoded URL`);
      }
    });
  }
  if (domains.size) {
    out.push(`external domains referenced: ${[...domains].sort().slice(0, 25).join(", ")}`);
  }
  return out;
}

function scanFileOps(files: ScannedFile[]): string[] {
  return [
    ...grep(files, /rm\s+-rf\s+[/~]/, (l) => `recursive delete of system path: ${l}`),
    ...grep(files, /del\s+\/[fsq]/i, (l) => `forced Windows delete: ${l}`),
    ...grep(files, /reg\s+add\b/i, (l) => `registry modification: ${l}`),
    ...grep(files, /chmod\s+777/, (l) => `world-writable permissions: ${l}`),
    ...grep(files, /(curl|wget)[^|\n]*\|\s*(sh|bash)/, (l) => `remote script piped to shell: ${l}`,
      (r) => !/(^|\/)Makefile$/.test(r)),
    ...grep(files, />\s*\/etc\//, (l) => `write to /etc: ${l}`),
  ];
}

function scanCron(files: ScannedFile[]): string[] {
  return [
    ...grep(files, /^\s*(schedule:|-\s*cron:)/, (l) => `CI schedule: ${l}`,
      (r) => r.startsWith(".github/workflows/")),
    ...grep(files, /\b(node-cron|croner|APScheduler|BackgroundScheduler|schedule\.every|crontab)\b/,
      (l) => `scheduler usage: ${l}`),
  ];
}

function scanDocker(files: ScannedFile[]): string[] {
  const isDocker = (r: string) => /(^|\/)(Dockerfile|docker-compose\.ya?ml)$/.test(r);
  return [
    ...grep(files, /privileged:\s*true|--privileged/, (l) => `privileged container: ${l}`, isDocker),
    ...grep(files, /^ADD\s+https?:/i, (l) => `ADD from remote URL: ${l}`, isDocker),
    ...grep(files, /(curl|wget)[^|\n]*\|\s*(sh|bash)/, (l) => `remote script pipe in image build: ${l}`, isDocker),
    ...grep(files, /ENTRYPOINT[^\n]*https?:\/\//i, (l) => `ENTRYPOINT references remote URL: ${l}`, isDocker),
  ];
}

function scanDependencies(files: ScannedFile[]): string[] {
  const out: string[] = [];
  for (const f of files) {
    if (f.rel.endsWith("package.json")) {
      try {
        const pkg = JSON.parse(f.lines.join("\n")) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        const list = Object.entries(deps).map(([n, v]) => `${n}@${v}`);
        if (list.length) out.push(`${f.rel}: ${list.join(", ")}`);
      } catch { /* ignore */ }
    }
    if (/requirements.*\.txt$/.test(f.rel)) {
      const list = f.lines.map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
      if (list.length) out.push(`${f.rel}: ${list.join(", ")}`);
    }
  }
  return out;
}
