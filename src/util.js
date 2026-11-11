// Small helpers shared by every module. The build output is byte-for-byte specified
// (see the golden test), so string, path and sort handling here is deliberately exact.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

/** Lines of a string, split on \n, \r\n or \r. A trailing newline does not add an empty last line. */
export function splitLines(text) {
  if (text === "") return [];
  const lines = text.split(/\r\n|\r|\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  return lines;
}

/** Strip any of the given characters from both ends. */
export function stripChars(text, chars) {
  let start = 0;
  let end = text.length;
  while (start < end && chars.includes(text[start])) start++;
  while (end > start && chars.includes(text[end - 1])) end--;
  return text.slice(start, end);
}

/** "Has a value": "", null, [], {}, 0 and false do not. */
export function truthy(value) {
  if (value === null || value === undefined || value === "" || value === 0 || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function asList(value) {
  if (value === null || value === undefined || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

/** Fill a message template: "{name}" substitutes, "{{" / "}}" are literal braces. */
export function format(template, values = {}) {
  return template.replace(/\{\{|\}\}|\{(\w+)\}/g, (match, name) => {
    if (match === "{{") return "{";
    if (match === "}}") return "}";
    if (!(name in values)) throw new Error(`format: missing value for {${name}}`);
    return String(values[name]);
  });
}

/** Compare two arrays element by element (lexicographic). */
export function compareTuples(a, b) {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] < b[i]) return -1;
    if (a[i] > b[i]) return 1;
  }
  return a.length - b.length;
}

/** Stable sort by a key function that returns an array. */
export function sortBy(items, key) {
  return items.map((item, i) => [key(item), i, item])
    .sort((a, b) => compareTuples(a[0], b[0]) || a[1] - b[1])
    .map((entry) => entry[2]);
}

/** Remove duplicate arrays, then sort. */
export function uniqueSorted(tuples) {
  const seen = new Map();
  for (const t of tuples) seen.set(JSON.stringify(t), t);
  return [...seen.values()].sort(compareTuples);
}

export function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\\-]/g, "\\$&");
}

// ── Paths ──────────────────────────────────────────────────────────────────────

/** Join paths, but an absolute `rel` replaces `base` (path.join would concatenate the two). */
export function joinPath(base, rel) {
  return path.normalize(path.isAbsolute(rel) ? rel : path.join(base, rel));
}

/** Relative link from a folder to a file, with forward slashes. */
export function link(target, fromDir) {
  return path.relative(path.resolve(fromDir), path.resolve(target)).split(path.sep).join("/") || ".";
}

/** A path for humans: relative to the working directory unless that climbs out more than one level. */
export function shown(p) {
  const rel = path.relative(process.cwd(), path.resolve(p)) || ".";
  return rel.startsWith(".." + path.sep + "..") ? path.resolve(p) : rel;
}

export function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

export function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Read a text file, normalising \r\n and \r to \n so Windows line endings never change hashes or output. */
export function readText(p) {
  return fs.readFileSync(p, "utf8").replace(/\r\n?/g, "\n");
}

// ── Hashes ─────────────────────────────────────────────────────────────────────

export function sha256File(p) {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

export function sha256Text(text) {
  return crypto.createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");
}

// ── Dates (calendar dates, no time zone) ──────────────────────────────────────

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** "YYYY-MM-DD" -> day number since the epoch. Throws on an impossible date. */
export function toDay(value) {
  const text = String(value);
  if (!DATE_RE.test(text)) throw new Error(`not a date: ${text}`);
  const [y, m, d] = text.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== m - 1 || back.getUTCDate() !== d) {
    throw new Error(`not a date: ${text}`);
  }
  return ms / 86400000;
}

export function dayToIso(day) {
  return new Date(day * 86400000).toISOString().slice(0, 10);
}

export function todayDay() {
  const now = new Date();
  return Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
}

/** Left-aligned, space-padded column. */
export function pad(text, width) {
  return String(text).padEnd(width);
}
