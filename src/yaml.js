// YAML subset parser.
// Supports exactly what templates/metadata.yaml uses: `key: value`, nested maps,
// block lists (of scalars or maps), inline [a, b] lists, inline {k: v} maps,
// quoted strings, and # comments. All scalars stay strings (dates included), so
// parsing is identical on every machine.

import { splitLines } from "./util.js";

export class YamlError extends Error {}

function stripComment(line) {
  const out = [];
  let quote = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
    } else if ((ch === "'" || ch === '"') && ["", ":", "-", "[", "{", ","].includes(line.slice(0, i).trimEnd().slice(-1))) {
      quote = ch;
    } else if (ch === "#" && (i === 0 || line[i - 1] === " " || line[i - 1] === "\t")) {
      break;
    }
    out.push(ch);
  }
  return out.join("").trimEnd();
}

function splitFlow(s) {
  const parts = [];
  let depth = 0;
  let quote = null;
  let cur = [];
  for (const ch of s) {
    if (quote) {
      if (ch === quote) quote = null;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
    } else if (ch === "," && depth === 0) {
      parts.push(cur.join(""));
      cur = [];
      continue;
    }
    cur.push(ch);
  }
  if (cur.join("").trim()) parts.push(cur.join(""));
  return parts.map((p) => p.trim());
}

function scalar(raw) {
  const s = raw.trim();
  if (s.length >= 2 && s[0] === s[s.length - 1] && (s[0] === "'" || s[0] === '"')) return s.slice(1, -1);
  if (s === "" || s === "~" || s === "null") return null;
  if (s.startsWith("[") && s.endsWith("]")) return splitFlow(s.slice(1, -1)).map(scalar);
  if (s.startsWith("{") && s.endsWith("}")) {
    const d = {};
    for (const part of splitFlow(s.slice(1, -1))) {
      const [k, v] = partition(part, ":");
      d[k.trim()] = scalar(v);
    }
    return d;
  }
  return s;
}

/** Split at the first `sep`: [before, after, found]. */
function partition(text, sep) {
  const i = text.indexOf(sep);
  return i < 0 ? [text, "", false] : [text.slice(0, i), text.slice(i + sep.length), true];
}

const isItem = (text) => text === "-" || text.startsWith("- ");

function block(lines, i) {
  return isItem(lines[i][1]) ? list(lines, i, lines[i][0]) : map(lines, i, lines[i][0]);
}

function map(lines, i, indent) {
  const d = {};
  while (i < lines.length && lines[i][0] === indent && !isItem(lines[i][1])) {
    const [key, rest, found] = partition(lines[i][1], ":");
    if (!found) throw new YamlError("expected `key: value` at: " + lines[i][1]);
    i++;
    if (rest.trim()) {
      d[key.trim()] = scalar(rest);
    } else if (i < lines.length && (lines[i][0] > indent || (lines[i][0] === indent && isItem(lines[i][1])))) {
      [d[key.trim()], i] = block(lines, i);
    } else {
      d[key.trim()] = null;
    }
  }
  return [d, i];
}

function list(lines, i, indent) {
  const out = [];
  while (i < lines.length && lines[i][0] === indent && isItem(lines[i][1])) {
    const item = lines[i][1].slice(1).trim();
    i++;
    if (!item) {
      if (i < lines.length && lines[i][0] > indent) {
        let value;
        [value, i] = block(lines, i);
        out.push(value);
      } else {
        out.push(null);
      }
    } else if (/^[\w-]+:(\s|$)/.test(item)) {
      const [key, rest] = partition(item, ":");
      const d = { [key.trim()]: scalar(rest) };
      if (i < lines.length && lines[i][0] > indent) {
        let more;
        [more, i] = map(lines, i, lines[i][0]);
        Object.assign(d, more);
      }
      out.push(d);
    } else {
      out.push(scalar(item));
    }
  }
  return [out, i];
}

/** Parse the YAML subset into plain objects, arrays, strings and nulls. Throws YamlError. */
export function parseYaml(text) {
  const lines = [];
  for (const raw of splitLines(text)) {
    const line = stripComment(raw);
    if (line.trim()) lines.push([line.length - line.replace(/^ +/, "").length, line.trim()]);
  }
  if (!lines.length) return {};
  const [value, i] = block(lines, 0);
  if (i !== lines.length || Array.isArray(value) || value === null || typeof value !== "object") {
    const stop = i < lines.length ? lines[i][1] : "(top level is not a mapping)";
    throw new YamlError("unsupported YAML near: " + stop);
  }
  return value;
}
