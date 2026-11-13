// `kb export`: the whole knowledge base as one Markdown pack for an AI to read
// (a meeting assistant, a chat project, an upload to another tool). Deterministic:
// no dates, no absolute paths, documents in sortKey order.

import path from "node:path";
import { demote, stripComments } from "./markdown.js";
import { format, splitLines, stripChars } from "./util.js";

/** Lines of one document's block. */
function block(kb, doc, t) {
  const e = t.export;
  const c = t.colon;
  const where = path.relative(kb.src, doc.path).split(path.sep).join("/");
  const meta = [doc.id, doc.type, e.state[doc.state] || doc.state, doc.status,
    `${e.owner} ${doc.owner || "—"}`, `${e.updated} ${doc.updated || "—"}`, where];
  const out = doc.links().map(([rel, kind, target]) => `${rel} ${kind === "id" ? target : "`" + target + "`"}`);
  const inc = kb.incomingOf(doc.id).map(([rel, src]) => `${src} (${rel})`);
  const lines = [`## ${doc.id}${c}${doc.title}`, "", "> " + meta.join(" · ")];
  if (out.length) lines.push(`> ${e.links}${c}${out.join(" · ")}`);
  if (inc.length) lines.push(`> ${e.incoming}${c}${inc.join(" · ")}`);
  if (doc.files().length) lines.push(`> ${e.files}${c}${doc.files().map((f) => "`" + f + "`").join(" · ")}`);
  lines.push("");

  // Drop the document's own H1 (it repeats the title above) and push the rest below this block's H2.
  const body = splitLines(stripComments(doc.body));
  const first = body.findIndex((l) => l.trim());
  if (first >= 0 && /^# /.test(body[first]) && body[first].includes(doc.id)) body.splice(first, 1);
  const text = stripChars(demote(body.join("\n"), 2), "\n").replace(/\n{3,}/g, "\n\n");
  if (text.trim()) lines.push(text, "");
  return lines.join("\n") + "\n";
}

/** {preamble, blocks, ids}: the fixed explanation, then one string per exported document. */
export function exportParts(kb, t) {
  const e = t.export;
  const docs = kb.sortedDocs();
  const preamble = [`<!-- ${t.notice} -->`, "", "# " + e.title, "", ...e.intro, "",
    format(e.count, { n: docs.length }), "", ""].join("\n");
  return { preamble, blocks: docs.map((d) => block(kb, d, t)), ids: docs.map((d) => d.id) };
}

/** One blank line between blocks, one newline at the end - the same text `kb build` writes. */
const tidy = (text) => stripChars(text.replace(/\n{3,}/g, "\n\n"), "\n") + "\n";

/** The pack as one string. */
export function exportText(kb, t) {
  const { preamble, blocks } = exportParts(kb, t);
  return tidy(preamble + blocks.join(""));
}

/**
 * Split into files of at most `maxBytes` (UTF-8), never cutting a document. Every file starts
 * with the preamble. Returns {files: string[], oversized: string[]} - ids of documents that
 * alone exceed the limit (each gets a file of its own).
 */
export function splitExport(kb, t, maxBytes) {
  const { preamble, blocks, ids } = exportParts(kb, t);
  const size = (s) => Buffer.byteLength(s, "utf8");
  const files = [];
  const oversized = [];
  let cur = [];
  const flush = () => {
    if (cur.length) files.push(tidy(preamble + cur.join("")));
    cur = [];
  };
  blocks.forEach((b, i) => {
    const alone = size(tidy(preamble + b));
    if (alone > maxBytes) {
      flush();
      oversized.push(ids[i]);
      files.push(tidy(preamble + b));
      return;
    }
    if (cur.length && size(tidy(preamble + [...cur, b].join(""))) > maxBytes) flush();
    cur.push(b);
  });
  flush();
  return { files, oversized };
}
