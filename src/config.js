// Configuration: kb.config.yaml + extends.
//
// A project's kb.config.yaml may `extends:` profiles (a directory holding
// profile.yaml, or a .yaml file), which may extend others. Layers are applied in
// order - extended layers first, the extending file last:
//   maps   merge key by key     · lists  union (append new items)
//   scalars: later layer wins   · `key!:` replaces instead of merging
// Everything that defines what the knowledge model *is* lives in model.js and
// cannot be configured: types, states, statuses, relations, evidence rules,
// AI may not own or approve. A profile can tighten the workflow, never loosen
// those invariants.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseYaml, YamlError } from "./yaml.js";
import { REQUIRED, TYPES } from "./model.js";
import { TEXT } from "./text.js";
import { asList, joinPath, isDir, isFile, isObject, readText, shown } from "./util.js";

/** The framework root: the folder holding src/, templates/, profiles/. */
export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CONFIG_NAME = "kb.config.yaml";
export const PROFILE_NAME = "profile.yaml";

export const DEFAULTS = {
  lang: "zh-TW", // 英文版儲存庫設為 "en"
  src: "docs",
  ownership: "OWNERSHIP.md",
  required_fields: [...REQUIRED],
  needs_approval: ["requirement", "business-rule", "adr", "api", "architecture"],
  review_days: { requirement: 90, "business-rule": 90, api: 90, architecture: 180, operations: 180 },
  exploratory_review_days: 30,
  cr_open_days: 14,
  clarification_open_days: 14,
  code_exts: [".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".java", ".kt", ".rb", ".php",
    ".cs", ".swift", ".rs", ".sql", ".vue", ".svelte", ".scala", ".dart",
    ".c", ".cc", ".cpp", ".h", ".hpp"],
  skip_dirs: ["node_modules", "_build", "dist", "build", "venv", "__pycache__"],
  ai_context: { instructions: [], include: [] },
};
const LOCKED = ["types", "statuses", "knowledge_states", "knowledge_state", "confidence",
  "relations", "rels", "evidence_rels", "invariants"];
const UNION_ONLY = ["required_fields"]; // may grow, never shrink: the core fields are invariants
export const PATH_KEYS = ["src", "ownership"];

function parseDays(value) {
  if (String(value) === "never") return null;
  const match = /^(\d+)d?$/.exec(String(value));
  if (!match) throw new RangeError(String(value));
  return parseInt(match[1], 10);
}

function mergeList(current, value, replace) {
  const items = asList(value).map(String);
  return replace ? items : current.concat(items.filter((i) => !current.includes(i)));
}

function applyLayer(cfg, layer, where, errors) {
  const base = path.dirname(where);
  for (const [raw, value] of Object.entries(layer)) {
    if (raw === "extends") continue;
    const replace = raw.endsWith("!");
    const key = replace ? raw.slice(0, -1) : raw;
    const err = (code, kw = {}) => errors.push([code, where, { k: key, ...kw }]);
    if (LOCKED.includes(key)) {
      err("config_locked");
    } else if (!Object.hasOwn(DEFAULTS, key)) {
      err("config_unknown");
    } else if (replace && UNION_ONLY.includes(key)) {
      err("config_shrink");
    } else if (key === "review_days") {
      if (!isObject(value)) {
        err("config_bad", { v: value });
        continue;
      }
      const days = replace ? {} : cfg[key];
      for (const [typeName, rawDays] of Object.entries(value)) {
        try {
          if (!Object.hasOwn(TYPES, typeName)) throw new RangeError(typeName);
          days[typeName] = parseDays(rawDays);
        } catch {
          err("config_bad", { v: `${typeName}: ${rawDays}` });
        }
      }
      cfg[key] = days;
    } else if (key === "ai_context") {
      if (!isObject(value)) {
        err("config_bad", { v: value });
        continue;
      }
      for (const [subRaw, subValue] of Object.entries(value)) {
        const subReplace = replace || subRaw.endsWith("!");
        const sub = subRaw.replace(/!+$/, "");
        if (!Object.hasOwn(DEFAULTS.ai_context, sub)) {
          errors.push(["config_unknown", where, { k: "ai_context." + sub }]);
          continue;
        }
        const items = sub === "include" ? asList(subValue).map((p) => joinPath(base, String(p))) : subValue;
        cfg[key][sub] = mergeList(cfg[key][sub], items, subReplace);
      }
    } else if (Array.isArray(DEFAULTS[key])) {
      const items = mergeList(cfg[key], value, replace);
      const bad = key === "needs_approval" ? items.filter((i) => !Object.hasOwn(TYPES, i)) : [];
      if (bad.length) err("config_bad", { v: bad.join(", ") });
      else cfg[key] = items;
    } else if (typeof DEFAULTS[key] === "number") {
      try {
        cfg[key] = parseDays(value);
      } catch {
        err("config_bad", { v: value });
      }
    } else if (PATH_KEYS.includes(key)) {
      cfg[key] = joinPath(base, String(value));
    } else if (key === "lang" && !Object.hasOwn(TEXT, String(value))) {
      err("config_bad", { v: value });
    } else {
      cfg[key] = value;
    }
  }
}

/** `kb:<name>` → a profile shipped with kb (profiles/<name>), wherever kb is installed. */
export const BUILTIN_PREFIX = "kb:";

function layerPath(ref, base) {
  ref = String(ref);
  const full = ref.startsWith(BUILTIN_PREFIX)
    ? path.join(ROOT, "profiles", ref.slice(BUILTIN_PREFIX.length))
    : joinPath(base, ref);
  if (isDir(full)) {
    for (const name of [PROFILE_NAME, CONFIG_NAME]) {
      if (isFile(path.join(full, name))) return path.join(full, name);
    }
    return path.join(full, PROFILE_NAME);
  }
  return full;
}

function collect(file, stack, done, layers, errors, via) {
  if (stack.includes(file)) {
    errors.push(["config_cycle", via, { k: [...stack, file].map(shown).join(" → ") }]);
    return;
  }
  if (done.has(file)) return; // diamond: a profile reached twice is applied once, at its first position
  let data;
  try {
    data = parseYaml(readText(file));
  } catch (e) {
    if (e instanceof YamlError) errors.push(["config_yaml", file, { k: e.message }]);
    else errors.push(["config_missing", via, { k: shown(file) }]);
    return;
  }
  for (const ref of asList(data.extends)) {
    collect(layerPath(ref, path.dirname(file)), [...stack, file], done, layers, errors, file);
  }
  done.add(file);
  layers.push([file, data]);
}

/**
 * Resolve the configuration.
 * @param {string|null} file kb.config.yaml to load; null means built-in defaults only
 * @returns {{cfg: object, errors: Array}} cfg also carries `layers` (applied files) and `projectDir`
 */
export function loadConfig(file) {
  const cfg = structuredClone(DEFAULTS);
  const errors = [];
  const layers = [];
  let projectDir = ROOT;
  if (file) {
    file = path.resolve(file);
    projectDir = path.dirname(file);
    collect(file, [], new Set(), layers, errors, file);
  }
  Object.defineProperty(cfg, "layers", { value: layers.map(([p]) => p), enumerable: false });
  Object.defineProperty(cfg, "projectDir", { value: projectDir, enumerable: false });
  for (const [where, data] of layers) applyLayer(cfg, data, where, errors);
  for (const key of PATH_KEYS) cfg[key] = joinPath(projectDir, cfg[key]);
  return { cfg, errors };
}

/** --config, else ./kb.config.yaml, else the one at the framework root. */
export function findConfig(explicit) {
  if (explicit) return explicit;
  for (const folder of [process.cwd(), ROOT]) {
    const candidate = path.join(folder, CONFIG_NAME);
    if (isFile(candidate)) return candidate;
  }
  return null;
}

