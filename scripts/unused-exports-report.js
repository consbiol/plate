/**
 * Report unused ES module exports (heuristic).
 *
 * Goal:
 * - Find exported names that are never imported anywhere in `src/`.
 *
 * Conservative rules:
 * - If a module is imported via `import * as ns from '...'`, we treat ALL exports
 *   of that module as used (namespace access is hard to track safely).
 * - Supports re-export propagation (`export * from` / `export {..} from`) so that
 *   barrel files don't create false positives.
 *
 * Limitations:
 * - Does not fully parse JavaScript (regex-based).
 * - Dynamic access, computed import paths, and runtime `require` patterns can evade detection.
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = process.cwd();
const SRC_ROOT = path.resolve(PROJECT_ROOT, 'src');

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

function extractVueScript(vueText) {
  // Best-effort: first <script>...</script> block (ignore <script setup>)
  const m = vueText.match(/<script(?!\s+setup)[^>]*>([\s\S]*?)<\/script>/i);
  return m ? m[1] : '';
}

const allFiles = walk(SRC_ROOT).filter((f) => EXTS.has(path.extname(f)));
const fileText = new Map();
function readText(file) {
  if (fileText.has(file)) return fileText.get(file);
  const raw = fs.readFileSync(file, 'utf8');
  const text = path.extname(file) === '.vue' ? extractVueScript(raw) : raw;
  fileText.set(file, text);
  return text;
}

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

// --- import parsing ---
const IMPORT_NAMED_RE = /\bimport\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;
const IMPORT_NS_RE = /\bimport\s*\*\s*as\s+\w+\s*from\s*["']([^"']+)["']/g;
const IMPORT_DEFAULT_RE = /\bimport\s+([A-Za-z_$][\w$]*)\s*from\s*["']([^"']+)["']/g;
const IMPORT_SIDE_EFFECT_RE = /\bimport\s*["']([^"']+)["']/g;

// --- export parsing ---
const EXPORT_FUNC_RE = /\bexport\s+function\s+([A-Za-z_$][\w$]*)\b/g;
const EXPORT_CLASS_RE = /\bexport\s+class\s+([A-Za-z_$][\w$]*)\b/g;
const EXPORT_CONST_RE = /\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g;
const EXPORT_NAMED_LIST_RE = /\bexport\s*\{([^}]+)\}\s*;?/g;
const EXPORT_DEFAULT_RE = /\bexport\s+default\b/g;

// --- re-export parsing ---
const REEXPORT_ALL_RE = /\bexport\s+\*\s+from\s+["']([^"']+)["']/g;
const REEXPORT_NAMED_FROM_RE = /\bexport\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g;

function splitSpecList(s) {
  // "a, b as c, d" -> [{imported:'a', local:'a'}, ...]
  return s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
    .map((item) => {
      const m = item.match(/^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/);
      if (!m) return null;
      const imported = m[1];
      const local = m[2] || m[1];
      return { imported, local };
    })
    .filter(Boolean);
}

function collectImports(file) {
  const s = readText(file);
  /** @type {{type:'named'|'ns'|'default'|'side', spec:string, names?:{imported:string, local:string}[], local?:string}[]} */
  const out = [];

  IMPORT_NAMED_RE.lastIndex = 0;
  let m;
  while ((m = IMPORT_NAMED_RE.exec(s))) {
    out.push({ type: 'named', spec: m[2], names: splitSpecList(m[1]) });
  }

  IMPORT_NS_RE.lastIndex = 0;
  while ((m = IMPORT_NS_RE.exec(s))) {
    out.push({ type: 'ns', spec: m[1] });
  }

  IMPORT_DEFAULT_RE.lastIndex = 0;
  while ((m = IMPORT_DEFAULT_RE.exec(s))) {
    out.push({ type: 'default', spec: m[2], local: m[1] });
  }

  IMPORT_SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = IMPORT_SIDE_EFFECT_RE.exec(s))) {
    // avoid double counting "import x from" / "import {..} from" by filtering those with "from"
    // (the regex will match them too). Best-effort: require that the match is not followed by "from".
    const idx = m.index;
    const tail = s.slice(idx, idx + 40);
    if (/\bfrom\b/.test(tail)) continue;
    out.push({ type: 'side', spec: m[1] });
  }

  return out;
}

function collectLocalExports(file) {
  const s = readText(file);
  const names = new Set();

  for (const re of [EXPORT_FUNC_RE, EXPORT_CLASS_RE, EXPORT_CONST_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s))) names.add(m[1]);
  }

  EXPORT_NAMED_LIST_RE.lastIndex = 0;
  let m;
  while ((m = EXPORT_NAMED_LIST_RE.exec(s))) {
    const list = splitSpecList(m[1]);
    for (const it of list) names.add(it.local);
  }

  const hasDefault = EXPORT_DEFAULT_RE.test(s);
  return { names, hasDefault };
}

function collectReexports(file) {
  const s = readText(file);
  /** @type {{type:'all', spec:string} | {type:'named', spec:string, mappings:{imported:string, local:string}[]}[]} */
  const edges = [];

  REEXPORT_ALL_RE.lastIndex = 0;
  let m;
  while ((m = REEXPORT_ALL_RE.exec(s))) edges.push([{ type: 'all', spec: m[1] }][0]);

  REEXPORT_NAMED_FROM_RE.lastIndex = 0;
  while ((m = REEXPORT_NAMED_FROM_RE.exec(s))) {
    edges.push({ type: 'named', spec: m[2], mappings: splitSpecList(m[1]) });
  }

  return edges;
}

// Build module metadata
const modules = new Map(); // file -> { exports, reexports, imports }
for (const f of allFiles) {
  modules.set(path.resolve(f), {
    exports: collectLocalExports(f),
    reexports: collectReexports(f),
    imports: collectImports(f),
  });
}

// Usage tracking
const usedNamed = new Map(); // file -> Set<exportName>
const usedDefault = new Set(); // file
const usedNamespace = new Set(); // file

function markNamed(file, name) {
  if (!usedNamed.has(file)) usedNamed.set(file, new Set());
  usedNamed.get(file).add(name);
}

// Seed usage from imports
for (const [fromFile, meta] of modules) {
  for (const imp of meta.imports) {
    const resolved = resolveSpec(fromFile, imp.spec);
    if (!resolved) continue;
    if (!modules.has(resolved)) continue;

    if (imp.type === 'ns') {
      usedNamespace.add(resolved);
      continue;
    }
    if (imp.type === 'default') {
      usedDefault.add(resolved);
      continue;
    }
    if (imp.type === 'named') {
      for (const it of imp.names || []) markNamed(resolved, it.imported);
      continue;
    }
    // side-effect import: doesn't imply exports are used
  }
}

// Propagate usage through re-exports (barrels)
for (let iter = 0; iter < 8; iter++) {
  let changed = false;

  for (const [modFile, meta] of modules) {
    const usedHere = usedNamed.get(modFile);
    if (!usedHere || usedHere.size === 0) continue;

    for (const re of meta.reexports) {
      const dep = resolveSpec(modFile, re.spec);
      if (!dep || !modules.has(dep)) continue;

      if (re.type === 'all') {
        for (const name of usedHere) {
          const before = usedNamed.get(dep)?.has(name) ?? false;
          markNamed(dep, name);
          const after = usedNamed.get(dep)?.has(name) ?? false;
          if (!before && after) changed = true;
        }
      } else if (re.type === 'named') {
        for (const map of re.mappings) {
          if (!usedHere.has(map.local)) continue;
          const before = usedNamed.get(dep)?.has(map.imported) ?? false;
          markNamed(dep, map.imported);
          const after = usedNamed.get(dep)?.has(map.imported) ?? false;
          if (!before && after) changed = true;
        }
      }
    }
  }

  if (!changed) break;
}

// Compute unused exports
/** @type {{file:string, name:string}[]} */
const unused = [];
let totalExports = 0;

for (const [file, meta] of modules) {
  const exp = meta.exports;
  for (const name of exp.names) {
    totalExports++;
    if (usedNamespace.has(file)) continue; // conservative
    if (usedNamed.get(file)?.has(name)) continue;
    unused.push({ file, name });
  }
  if (exp.hasDefault) {
    if (!usedDefault.has(file)) {
      // default exports are often used implicitly via routers; still useful to report
      unused.push({ file, name: 'default' });
    }
  }
}

unused.sort((a, b) => (a.file === b.file ? a.name.localeCompare(b.name) : a.file.localeCompare(b.file)));

// Output
// eslint-disable-next-line no-console
console.log(`TOTAL_MODULES: ${modules.size}`);
// eslint-disable-next-line no-console
console.log(`TOTAL_LOCAL_EXPORTS: ${totalExports}`);
// eslint-disable-next-line no-console
console.log(`UNUSED_EXPORTS: ${unused.length}`);

let last = '';
for (const u of unused) {
  const rel = path.relative(PROJECT_ROOT, u.file);
  if (rel !== last) {
    // eslint-disable-next-line no-console
    console.log(`\n${rel}`);
    last = rel;
  }
  // eslint-disable-next-line no-console
  console.log(`  - ${u.name}`);
}

