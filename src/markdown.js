// Markdown helpers: sections, tables, comments.

import { splitLines, stripChars } from "./util.js";

export function stripComments(text) {
  return stripChars(text.replace(/<!--[\s\S]*?-->\s*/g, ""), "\n");
}

/** Level-2 sections of a document body: [[heading, content]]. */
export function splitSections(body) {
  const sections = [];
  let heading = null;
  let buf = [];
  let fence = false;
  for (const line of splitLines(body)) {
    if (line.trimStart().startsWith("```")) fence = !fence;
    if (!fence && line.startsWith("## ")) {
      if (heading !== null) sections.push([heading, buf.join("\n")]);
      heading = line.slice(3).trim();
      buf = [];
    } else if (heading !== null) {
      buf.push(line);
    }
  }
  if (heading !== null) sections.push([heading, buf.join("\n")]);
  return sections;
}

/** Push every heading down by `levels` (outside code fences). */
export function demote(text, levels) {
  const out = [];
  let fence = false;
  for (let line of splitLines(text)) {
    if (line.trimStart().startsWith("```")) fence = !fence;
    if (!fence && /^#{1,5} /.test(line)) line = "#".repeat(levels) + line;
    out.push(line);
  }
  return out.join("\n");
}

/** First Markdown table in text -> [header, rows]. */
export function parseTable(text) {
  const rows = [];
  for (const line of splitLines(text)) {
    const s = line.trim();
    if (s.startsWith("|")) {
      rows.push(stripChars(s, "|").split(/(?<!\\)\|/).map((c) => c.trim()));
    } else if (rows.length) {
      break;
    }
  }
  if (rows.length < 2) return [[], []];
  const body = rows.slice(2).filter((r) => r.some((c) => c));
  return [rows[0], body];
}

export function colIndex(header, names) {
  for (let i = 0; i < header.length; i++) {
    const h = header[i].toLowerCase();
    if (names.some((n) => h.startsWith(n.toLowerCase()))) return i;
  }
  return null;
}

export function cell(text) {
  return String(text).replaceAll("|", "\\|").replaceAll("\n", " ");
}

export function mdTable(header, rows) {
  const out = ["| " + header.join(" | ") + " |", "|" + "---|".repeat(header.length)];
  for (const r of rows) out.push("| " + r.map(cell).join(" | ") + " |");
  return out.join("\n");
}
