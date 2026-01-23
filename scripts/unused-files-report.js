/**
 * Report unused source files by static import graph walk.
 *
 * This script is intentionally dependency-free (Node.js only).
 * It helps identify "safe to delete" candidates by finding JS/Vue files
 * that are NOT reachable from the application entrypoint (`src/main.js`)
 * via static import/require/import() statements.
 *
 * Notes:
 * - This is a heuristic, not a proof. Dynamic path construction or runtime
 *   loading via URLs won't be detected.
 * - We treat `src/main.js` as the only entrypoint.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.resolve(PROJECT_ROOT, 'src');
const ENTRY = path.resolve(SRC_ROOT, 'main.js');

const EXTS = new Set(['.js', '.vue']);

function walk(dir, out = []) {
  const ents = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of ents) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const allFiles = walk(SRC_ROOT).filter((f) => EXTS.has(path.extname(f)));
const allSet = new Set(allFiles.map((f) => path.resolve(f)));

const cache = new Map();
function readText(file) {
  if (!cache.has(file)) cache.set(file, fs.readFileSync(file, 'utf8'));
  return cache.get(file);
}

// Very small regex set: good enough for this codebase.
const IMPORT_RE = /\bimport\s+(?:[^'";]+?\s+from\s+)?["']([^"']+)["']/g;
// Re-export statements also create dependencies (important for barrel files).
const EXPORT_FROM_RE = /\bexport\s+(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g;
const REQUIRE_RE = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
const DYNAMIC_IMPORT_RE = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

function resolveSpec(fromFile, spec) {
  if (!spec || !spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.vue`,
    path.join(base, 'index.js'),
    path.join(base, 'index.vue'),
  ];
  for (const c of candidates) {
    try {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.resolve(c);
    } catch {
      // ignore
    }
  }
  return null;
}

function collectDeps(fromFile) {
  const s = readText(fromFile);
  const deps = [];
  for (const re of [IMPORT_RE, EXPORT_FROM_RE, REQUIRE_RE, DYNAMIC_IMPORT_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) {
      const resolved = resolveSpec(fromFile, m[1]);
      if (resolved) deps.push(resolved);
    }
  }
  return deps;
}

function walkGraph(entry) {
  const visited = new Set();
  const stack = [entry];
  while (stack.length) {
    const f = stack.pop();
    if (!f || visited.has(f)) continue;
    visited.add(f);
    for (const d of collectDeps(f)) stack.push(d);
  }
  return visited;
}

if (!fs.existsSync(ENTRY)) {
  // eslint-disable-next-line no-console
  console.error(`Entry not found: ${path.relative(PROJECT_ROOT, ENTRY)}`);
  process.exit(2);
}

const used = walkGraph(ENTRY);
const unused = [...allSet].filter((f) => !used.has(f)).sort();

// eslint-disable-next-line no-console
console.log(`ENTRY: ${path.relative(PROJECT_ROOT, ENTRY)}`);
// eslint-disable-next-line no-console
console.log(`USED_FILES: ${used.size}`);
// eslint-disable-next-line no-console
console.log(`ALL_FILES: ${allSet.size}`);
// eslint-disable-next-line no-console
console.log(`UNUSED_FILES: ${unused.length}`);

for (const u of unused) {
  // eslint-disable-next-line no-console
  console.log(path.relative(PROJECT_ROOT, u));
}

