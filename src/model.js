// The knowledge model (mirrors templates/metadata.yaml) and the document graph.
// Everything in this file is an invariant: configuration cannot change it.

import fs from "node:fs";
import path from "node:path";
import { parseYaml, YamlError } from "./yaml.js";
import { splitSections, stripComments } from "./markdown.js";
import { asList, joinPath, isObject, readText, sortBy, compareTuples, truthy } from "./util.js";

export const TYPES = {
  "exploration": ["EXP", "exploratory"],
  "prototype": ["PROTO", "exploratory"],
  "feedback": ["FB", "exploratory"],
  "product-context": ["PROD", "authoritative"],
  "requirement": ["REQ", "authoritative"],
  "change-request": ["CR", "authoritative"],
  "business-rule": ["BR", "authoritative"],
  "architecture": ["ARCH", "authoritative"],
  "adr": ["ADR", "authoritative"],
  "api": ["API", "authoritative"],
  "operations": ["OPS", "authoritative"],
  "reference": ["REF", "record"],
  "clarification": ["CLR", "record"],
  "report": ["RPT", "record"],
};
export const TYPE_ORDER = Object.keys(TYPES);
export const STATUSES = ["draft", "review", "approved", "active", "deprecated", "archived"];
export const CONFIDENCE = {
  exploratory: ["idea", "hypothesis", "supported", "confirmed"],
  authoritative: ["high", "medium", "low"],
  record: ["high", "medium", "low"], // how far we trust the source; optional
};
export const NON_AUTHORITATIVE = ["exploratory", "record"]; // evidence: may be cited, never depended on
// stored relation -> derived inverse
export const RELS = {
  explores: "explored_by",
  evidence_for: "has_evidence",
  derived_from: "derives",
  decides_for: "decided_by",
  governed_by: "governs",
  implements: "implemented_by",
  implemented_in: "implements",
  verified_by: "verifies",
  changes: "changed_by",
  supersedes: "superseded_by",
  relates_to: "relates_to",
};
export const REQUIRED = ["id", "title", "type", "knowledge_state", "status", "owner"];
export const STALE_RELS = ["derived_from", "implements", "governed_by"];
export const EVIDENCE_RELS = ["derived_from", "relates_to"]; // the only ways authoritative may cite exploratory / record
export const CODE_RELS = ["implemented_in", "verified_by"]; // path links that point into the code repository
export const DATE_FIELDS = ["created", "updated", "last_reviewed"];
export const ID_REF_SOURCE = String.raw`\b(?:${Object.values(TYPES).map(([prefix]) => prefix).join("|")})-\d{3,}\b`;
export const idRefs = (text) => text.match(new RegExp(ID_REF_SOURCE, "g")) || [];
export const BUILD_MARKER = ".kb-build";
export const SEAL_BODY_TYPES = ["clarification", "report"]; // their body *is* the record; a REF's body is our notes about it
export const ORIGINALS_DIR = "_originals"; // skipped by the scanner (leading "_"), holds the files a record points to
export const CLR_ROW_STATUSES = ["open", "answered", "dropped"];

// Section headings are matched by prefix, in either language.
export const SECTIONS = {
  problem: ["Problem", "問題"],
  goal: ["Goal", "目標"],
  users: ["Users", "使用者"],
  scope: ["Scope", "範圍"],
  ac: ["Acceptance criteria", "驗收條件"],
  constraints: ["Constraints", "限制"],
  open: ["Open questions", "未解問題"],
  history: ["Change history", "變更歷史"],
  rules: ["Rules", "規則"],
  params: ["Parameters", "參數"],
  rationale: ["Rationale", "理由"],
  examples: ["Examples", "範例"],
  context: ["Context", "背景"],
  decision: ["Decision", "決策"],
  consequences: ["Consequences", "後果"],
  tradeoffs: ["Trade-offs", "取捨"],
  notes: ["Notes", "備註"],
  overview: ["Overview", "概觀"],
  components: ["Components", "元件"],
  endpoint: ["Endpoint", "端點"],
  request: ["Request", "請求"],
  response: ["Response", "回應"],
  errors: ["Errors", "錯誤"],
  questions: ["Questions", "問題清單"],
  summary: ["Summary", "摘要"],
};
export const CLR_STATUS_COLS = ["Status", "狀態"];
export const CLR_LANDED_COLS = ["Landed in", "落地"];
export const HISTORY_CHANGE_COLS = ["Change", "Note", "變更", "備註"];
export const HISTORY_REASON_COLS = ["Reason", "原因"];
export const HISTORY_VERSION_COLS = ["Version", "版本"];

const empty = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);

export class Doc {
  constructor(meta, body, file, standalone = false) {
    this.meta = meta;
    this.body = body;
    this.path = file;
    this.standalone = standalone; // has its own front matter (one document per file)
    this._sections = null;
  }

  get(key) {
    const value = this.meta[key];
    return empty(value) ? null : value;
  }

  get id() { return this.get("id") || ""; }
  get type() { return this.get("type") || ""; }
  get state() { return this.get("knowledge_state") || ""; }
  get status() { return this.get("status") || ""; }
  get title() { return this.get("title") || ""; }
  get owner() { return this.get("owner") || ""; }
  get updated() { return this.get("updated") || this.get("created") || ""; }

  /** [heading, content] of the first section matching `key`, or null when absent or empty. */
  find(key) {
    if (this._sections === null) this._sections = splitSections(this.body);
    for (const [heading, raw] of this._sections) {
      if (SECTIONS[key].some((a) => heading.toLowerCase().startsWith(a.toLowerCase()))) {
        const content = stripComments(raw);
        return content.trim() ? [heading, content] : null;
      }
    }
    return null;
  }

  rawLinks() {
    const related = this.meta.related || [];
    return Array.isArray(related) ? related : [related];
  }

  /** [[rel, kind, target]] where kind is "id" or "path". */
  links() {
    const out = [];
    for (const item of this.rawLinks()) {
      if (typeof item === "string") {
        out.push(["relates_to", "id", item]);
      } else if (isObject(item)) {
        const rel = truthy(item.rel) ? item.rel : "relates_to";
        if (truthy(item.id)) out.push([rel, "id", item.id]);
        else if (truthy(item.path)) out.push([rel, "path", item.path]);
      }
    }
    for (const target of asList(this.meta.supersedes)) out.push(["supersedes", "id", target]);
    return out;
  }

  /** Files a record points to, relative to the document's folder. */
  files() {
    return asList(this.meta.files).map(String);
  }

  filePath(rel) {
    return joinPath(path.dirname(this.path), rel);
  }

  seal() {
    return isObject(this.meta.seal) ? this.meta.seal : null;
  }

  /** {relative path: sha256} as stored in the seal. */
  sealedFiles() {
    const out = {};
    for (const item of asList((this.seal() || {}).files)) {
      if (isObject(item) && item.path) out[String(item.path)] = String(item.sha256 || "");
    }
    return out;
  }
}

export function sortKey(doc) {
  const num = doc.id.match(/\d+/);
  const rank = TYPE_ORDER.includes(doc.type) ? TYPE_ORDER.indexOf(doc.type) : TYPE_ORDER.length;
  return [rank, num ? parseInt(num[0], 10) : 0, doc.id];
}

export const FRONT_MATTER = /^---\n([\s\S]*?)\n---[ \t]*\n?/;
const YAML_BLOCK = /^```ya?ml\n([\s\S]*?)\n```[ \t]*$/m;

/** Parse one Markdown file into docs (one with front matter, or several "condensed" records). */
export function readFile(file, docs, problems) {
  const text = readText(file);
  const match = FRONT_MATTER.exec(text);
  if (match) {
    try {
      docs.push(new Doc(parseYaml(match[1]), text.slice(match[0].length), file, true));
    } catch (e) {
      if (!(e instanceof YamlError)) throw e;
      problems.push(["yaml", file, e.message]);
    }
    return;
  }
  // Condensed files: several records, each a "## heading" followed by a ```yaml block with an id.
  for (const [, content] of splitSections(text)) {
    const block = YAML_BLOCK.exec(content);
    if (!block) continue;
    let meta;
    try {
      meta = parseYaml(block[1]);
    } catch (e) {
      if (!(e instanceof YamlError)) throw e;
      problems.push(["yaml", file, e.message]);
      continue;
    }
    if (meta.id && meta.type) {
      docs.push(new Doc(meta, content.slice(0, block.index) + content.slice(block.index + block[0].length), file));
    }
  }
}

function sortedEntries(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Every .md file under src, sorted: a folder's own files first, then its sub-folders. */
function markdownFiles(dir, out = []) {
  const entries = sortedEntries(dir);
  for (const e of entries) if (e.isFile() && e.name.endsWith(".md")) out.push(path.join(dir, e.name));
  for (const e of entries) {
    if (e.isDirectory() && !e.name.startsWith(".") && !e.name.startsWith("_")) markdownFiles(path.join(dir, e.name), out);
  }
  return out;
}

export class KB {
  constructor(src) {
    this.src = src;
    this.all = [];
    this.problems = [];
    if (fs.existsSync(src)) {
      for (const file of markdownFiles(src)) readFile(file, this.all, this.problems);
    }
    this.docs = new Map();
    for (const doc of this.all) {
      if (doc.id && !this.docs.has(doc.id)) this.docs.set(doc.id, doc);
    }
    this.incoming = new Map();
    for (const doc of this.docs.values()) {
      for (const [rel, kind, target] of doc.links()) {
        if (kind === "id" && this.docs.has(target)) this.incomingOf(target).push([rel, doc.id]);
      }
    }
    for (const list of this.incoming.values()) list.sort(compareTuples);
  }

  incomingOf(id) {
    if (!this.incoming.has(id)) this.incoming.set(id, []);
    return this.incoming.get(id);
  }

  sortedDocs() {
    return sortBy([...this.docs.values()], sortKey);
  }

  /** Everything that belongs to one requirement: walk links both ways, but never
   *  into other requirements or product context, and never *through* exploratory
   *  documents, records or change requests (they are listed, not expanded). */
  feature(req) {
    const seen = new Set([req.id]);
    const queue = [req.id];
    while (queue.length) {
      const current = this.docs.get(queue.shift());
      const neighbours = current.links().filter(([, kind, t]) => kind === "id" && this.docs.has(t)).map(([, , t]) => t);
      for (const [, src] of this.incomingOf(current.id)) neighbours.push(src);
      for (const target of [...new Set(neighbours)].sort()) {
        const doc = this.docs.get(target);
        if (seen.has(target) || doc.type === "requirement" || doc.type === "product-context") continue;
        seen.add(target);
        if (doc.state === "authoritative" && doc.type !== "change-request") queue.push(target);
      }
    }
    seen.delete(req.id);
    return sortBy([...seen].map((id) => this.docs.get(id)), sortKey);
  }
}
