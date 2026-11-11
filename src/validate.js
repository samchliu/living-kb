// Validation: the deterministic part of the Documentation Health Agent.

import fs from "node:fs";
import path from "node:path";
import {
  TYPES, STATUSES, CONFIDENCE, NON_AUTHORITATIVE, RELS, EVIDENCE_RELS, CODE_RELS, DATE_FIELDS, STALE_RELS,
  SEAL_BODY_TYPES, CLR_ROW_STATUSES, CLR_STATUS_COLS, CLR_LANDED_COLS, idRefs,
} from "./model.js";
import { colIndex, parseTable } from "./markdown.js";
import {
  DATE_RE, joinPath, asList, compareTuples, format, isFile, isObject, pad, readText, sha256File, sha256Text, shown,
  stripChars, toDay, truthy,
} from "./util.js";

export class Finding {
  constructor(severity, category, docId, file, message) {
    Object.assign(this, { severity, category, docId, path: file, message });
  }

  key() {
    return [this.severity === "error" ? 0 : 1, this.category, this.docId, this.path, this.message];
  }
}

function reviewDays(doc, cfg) {
  const value = doc.get("review_every");
  if (truthy(value)) {
    if (String(value) === "never") return null;
    const match = /^(\d+)d$/.exec(String(value));
    return match ? parseInt(match[1], 10) : null;
  }
  if (doc.state === "exploratory") return cfg.exploratory_review_days;
  return cfg.review_days[doc.type] ?? null;
}

/** Days from a YYYY-MM-DD value, or null when it is not a real date. */
function day(value) {
  try {
    return toDay(value);
  } catch {
    return null;
  }
}

/** Roles listed in OWNERSHIP.md: the first column of each table row, in backticks. */
export function loadRoster(file) {
  let text;
  try {
    text = readText(file);
  } catch {
    return null;
  }
  const roles = new Set([...text.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]));
  return roles.size ? roles : null;
}

/** [[file, ids]] for every code file under codeRoot that mentions knowledge IDs. */
export function codeReferences(codeRoot, cfg) {
  const out = [];
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const e of entries) {
      if (!e.isFile() || !cfg.code_exts.some((ext) => e.name.endsWith(ext))) continue;
      const file = path.join(dir, e.name);
      try {
        if (fs.statSync(file).size > 1_000_000) continue;
        const ids = [...new Set(idRefs(fs.readFileSync(file, "utf8")))].sort();
        if (ids.length) out.push([file, ids]);
      } catch {
        continue;
      }
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.name.startsWith(".") && !cfg.skip_dirs.includes(e.name)) walk(path.join(dir, e.name));
    }
  };
  walk(codeRoot);
  return out;
}

/** Records are frozen evidence: check their files, their seal, and their own rules. */
function validateRecord(kb, doc, today, cfg, add) {
  const files = doc.files();
  for (const rel of files) {
    if (!isFile(doc.filePath(rel))) add("error", "BROKEN_LINK", doc, "file_missing", { p: rel });
  }
  const seal = doc.seal();
  if (doc.meta.seal !== null && doc.meta.seal !== undefined && !(seal && doc.standalone)) {
    add("error", "SCHEMA", doc, "seal_not_record");
  } else if (seal) {
    const stored = doc.sealedFiles();
    for (const rel of files) {
      if (!(rel in stored)) add("error", "IMMUTABLE", doc, "seal_file_added", { p: rel });
      else if (isFile(doc.filePath(rel)) && sha256File(doc.filePath(rel)) !== stored[rel]) {
        add("error", "IMMUTABLE", doc, "seal_file_changed", { p: rel });
      }
    }
    for (const rel of Object.keys(stored).filter((r) => !files.includes(r)).sort()) {
      add("error", "IMMUTABLE", doc, "seal_file_removed", { p: rel });
    }
    if (SEAL_BODY_TYPES.includes(doc.type) && String(seal.body || "") !== sha256Text(doc.body)) {
      add("error", "IMMUTABLE", doc, "seal_body_changed");
    }
  } else if (doc.type === "reference" || ["active", "deprecated", "archived"].includes(doc.status)) {
    add("warning", "MISSING", doc, "not_sealed", { i: doc.id });
  }

  if (doc.type === "clarification") {
    const found = doc.find("questions");
    const [head, rows] = found ? parseTable(found[1]) : [[], []];
    const statusCol = colIndex(head, CLR_STATUS_COLS);
    const landedCol = colIndex(head, CLR_LANDED_COLS);
    const pick = (row, i) => (i !== null && i < row.length ? stripChars(row[i].trim(), "`") : "");
    const openRows = [];
    for (const row of rows) {
      const q = row[0];
      const state = pick(row, statusCol).toLowerCase();
      if (!CLR_ROW_STATUSES.includes(state)) {
        add("warning", "SCHEMA", doc, "clr_bad_status", { q, v: state });
      } else if (state === "open") {
        openRows.push(q);
      } else if (state === "answered") {
        const landed = pick(row, landedCol);
        if (!landed) add("warning", "MISSING", doc, "clr_unlanded", { q });
        for (const target of idRefs(landed)) {
          if (!kb.docs.has(target)) add("error", "BROKEN_LINK", doc, "clr_landed_missing", { q, t: target });
        }
      }
    }
    const created = doc.get("created");
    if (openRows.length && ["draft", "review"].includes(doc.status) && created && day(created) !== null
        && day(created) + cfg.clarification_open_days < today) {
      add("warning", "MISSING", doc, "clr_open", { d: created, n: openRows.length });
    }
    if (openRows.length && ["active", "archived"].includes(doc.status)) {
      add("warning", "MISSING", doc, "clr_closed_open", { s: doc.status, q: openRows.join(", ") });
    }
  }

  if (doc.type === "report" && !["deprecated", "archived"].includes(doc.status)) {
    const made = String(doc.get("measured_on") || (seal || {}).on || doc.get("created") || "");
    for (const [rel, kind, target] of doc.links()) {
      if (kind === "id" && rel === "evidence_for" && kb.docs.has(target)) {
        const changed = kb.docs.get(target).updated;
        if (made && changed && DATE_RE.test(String(changed)) && changed > made) {
          add("warning", "STALE", doc, "report_outdated", { t: target, u: changed, d: made });
        }
      }
    }
  }
}

/**
 * Check every document. Returns sorted findings.
 * @param {import("./model.js").KB} kb
 * @param {number} today day number (see util.toDay)
 * @param {Set<string>|null} roster roles from OWNERSHIP.md
 * @param {string|null} codeRoot
 * @param {object} t TEXT[lang]
 * @param {object} cfg resolved configuration
 */
export function validate(kb, today, roster, codeRoot, t, cfg) {
  const findings = [];
  const add = (severity, category, doc, key, kw = {}, file = null) => {
    findings.push(new Finding(severity, category, doc ? doc.id : "", file || (doc ? doc.path : ""), format(t.msg[key], kw)));
  };

  for (const [kind, file, error] of kb.problems) add("error", "SCHEMA", null, kind, { e: error }, file);

  const firstSeen = new Map();
  for (const doc of kb.all) {
    // schema
    for (const field of cfg.required_fields) {
      if (!truthy(doc.get(field))) add("error", "SCHEMA", doc, "missing_field", { f: field });
    }
    if (doc.id && firstSeen.has(doc.id)) {
      add("error", "DUPLICATE", doc, "dup", { other: path.relative(process.cwd(), firstSeen.get(doc.id)) });
      continue;
    }
    firstSeen.set(doc.id, doc.path);
    if (doc.type && !Object.hasOwn(TYPES, doc.type)) {
      add("error", "SCHEMA", doc, "bad_value", { f: "type", v: doc.type });
    } else if (doc.type) {
      const [prefix, state] = TYPES[doc.type];
      if (doc.id && !new RegExp(`^${prefix}-\\d{3,}$`).test(doc.id)) {
        add("error", "SCHEMA", doc, "bad_prefix", { i: doc.id, t: doc.type, p: prefix });
      }
      if (doc.state && doc.state !== state) add("error", "SCHEMA", doc, "bad_state", { t: doc.type, s: state });
    }
    if (doc.state && !Object.hasOwn(CONFIDENCE, doc.state)) {
      add("error", "SCHEMA", doc, "bad_value", { f: "knowledge_state", v: doc.state });
    }
    if (doc.status && !STATUSES.includes(doc.status)) add("error", "SCHEMA", doc, "bad_value", { f: "status", v: doc.status });
    const confidence = doc.get("confidence");
    if (Object.hasOwn(CONFIDENCE, doc.state) && truthy(confidence) && !CONFIDENCE[doc.state].includes(confidence)) {
      add("error", "SCHEMA", doc, "bad_value", { f: "confidence", v: confidence });
    }
    if (doc.state === "exploratory" && !truthy(confidence)) add("error", "SCHEMA", doc, "missing_field", { f: "confidence" });
    if (doc.state === "exploratory" && ![null, "none"].includes(doc.get("source_of_truth"))) {
      add("error", "SCHEMA", doc, "exp_sot");
    }
    for (const field of DATE_FIELDS) {
      const value = doc.get(field);
      if (truthy(value) && !DATE_RE.test(String(value))) add("error", "SCHEMA", doc, "bad_date", { f: field, v: value });
    }
    const every = doc.get("review_every");
    if (truthy(every) && String(every) !== "never" && !/^\d+d$/.test(String(every))) {
      add("error", "SCHEMA", doc, "bad_value", { f: "review_every", v: every });
    }

    // links
    for (const item of doc.rawLinks()) {
      if (isObject(item)) {
        if (!(truthy(item.id) || truthy(item.path))) add("error", "SCHEMA", doc, "bad_link");
        if (truthy(item.rel) && !Object.hasOwn(RELS, item.rel)) add("error", "SCHEMA", doc, "bad_rel", { rel: item.rel });
      }
    }
    for (const [rel, kind, target] of doc.links()) {
      if (kind === "id") {
        if (!kb.docs.has(target)) {
          add("error", "BROKEN_LINK", doc, "broken", { t: target, rel });
        } else if (doc.state === "authoritative" && NON_AUTHORITATIVE.includes(kb.docs.get(target).state)
                   && !EVIDENCE_RELS.includes(rel)) {
          add("error", "CONFLICT", doc, "leak", { t: target, rel, s: kb.docs.get(target).state });
        }
      } else if (codeRoot && CODE_RELS.includes(rel) && !fs.existsSync(joinPath(codeRoot, String(target)))) {
        add("warning", "DRIFT", doc, "path_missing", { p: target, rel });
      }
    }
    for (const target of asList(doc.meta.superseded_by)) {
      if (!kb.docs.has(target)) add("error", "BROKEN_LINK", doc, "broken", { t: target, rel: "superseded_by" });
    }

    // ownership
    if (doc.owner === "AI") add("warning", "OWNERSHIP", doc, "owner_ai");
    else if (doc.owner && roster && !roster.has(doc.owner)) add("warning", "OWNERSHIP", doc, "owner_roster", { o: doc.owner });

    // records: files, seal, and type-specific rules (sealed records are checked even when archived)
    if (doc.state === "record" && Object.hasOwn(TYPES, doc.type)) {
      validateRecord(kb, doc, today, cfg, add);
      continue;
    }
    if (doc.meta.seal !== null && doc.meta.seal !== undefined) add("error", "SCHEMA", doc, "seal_not_record");

    // health - only for documents still in play
    if (["deprecated", "archived"].includes(doc.status) || !Object.hasOwn(TYPES, doc.type)) continue;
    const reviewed = doc.get("last_reviewed") || doc.updated;
    if (reviewed && DATE_RE.test(String(reviewed))) {
      const days = reviewDays(doc, cfg);
      if (days && day(reviewed) !== null && day(reviewed) + days < today) {
        add("warning", "STALE", doc, "stale_time", { d: reviewed, n: days });
      }
      for (const [rel, kind, target] of doc.links()) {
        if (kind === "id" && STALE_RELS.includes(rel) && kb.docs.has(target)) {
          const changed = kb.docs.get(target).updated;
          if (changed && DATE_RE.test(String(changed)) && changed > reviewed) {
            add("warning", "STALE", doc, "stale_link", { t: target, u: changed, d: reviewed });
          }
        }
      }
    }
    if (cfg.needs_approval.includes(doc.type) && ["approved", "active"].includes(doc.status)) {
      const approved = doc.meta.approved_by;
      if (!(isObject(approved) && truthy(approved.who))) add("warning", "MISSING", doc, "no_approval", { s: doc.status });
    }
    const idLinks = doc.links().filter(([, kind, target]) => kind === "id" && kb.docs.has(target))
      .map(([rel, , target]) => [rel, kb.docs.get(target).type]);
    if (doc.type === "business-rule" && !doc.links().some(([rel]) => rel === "verified_by")) {
      add("warning", "MISSING", doc, "no_tests");
    }
    if (doc.type === "requirement") {
      const ac = doc.find("ac");
      if (!(ac && parseTable(ac[1])[1].length)) add("warning", "MISSING", doc, "no_ac");
      if (!idLinks.some(([rel]) => rel === "derived_from")) add("warning", "ORPHAN", doc, "orphan_req");
    }
    if (doc.type === "business-rule" && !idLinks.some(([rel, type]) => rel === "derived_from" && type === "requirement")) {
      add("warning", "ORPHAN", doc, "orphan_br");
    }
    if (["api", "architecture"].includes(doc.type) && !idLinks.some(([rel]) => rel === "implements")) {
      add("warning", "ORPHAN", doc, "orphan_impl");
    }
    const created = doc.get("created");
    if (doc.type === "change-request" && ["draft", "review"].includes(doc.status) && created
        && day(created) !== null && day(created) + cfg.cr_open_days < today) {
      add("warning", "MISSING", doc, "cr_open", { d: created });
    }
  }

  if (codeRoot) {
    for (const [file, ids] of codeReferences(codeRoot, cfg)) {
      for (const ref of ids) {
        const doc = kb.docs.get(ref);
        if (!doc) add("warning", "ORPHAN", null, "code_unknown", { i: ref }, file);
        else if (doc.state === "exploratory") add("warning", "CONFLICT", null, "code_exploratory", { i: ref }, file);
        else if (["deprecated", "archived"].includes(doc.status) && doc.type !== "change-request") {
          add("warning", "ORPHAN", null, "code_deprecated", { i: ref, s: doc.status }, file);
        }
      }
    }
  }

  return findings.sort((a, b) => compareTuples(a.key(), b.key()));
}

export function overall(findings) {
  if (findings.some((f) => f.severity === "error")) return "CRITICAL";
  return findings.length ? "WARNING" : "HEALTHY";
}

export function printReport(kb, findings, today, todayIso, t, out) {
  const errors = findings.filter((f) => f.severity === "error").length;
  out(`${t.report_title}${t.colon}${overall(findings)}   (${shown(kb.src)} · ${format(t.docs_count, { n: kb.docs.size })} · today ${todayIso})`);
  for (const f of findings) {
    out(`  ${pad(f.severity.toUpperCase(), 7)}  ${pad(f.category, 11)}  ${pad(f.docId || "-", 9)}  ${f.message}   ${shown(f.path)}`);
  }
  out(format(t.summary, { e: errors, w: findings.length - errors }));
}

