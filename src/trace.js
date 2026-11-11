// `kb trace ID`: upstream (why it exists) and downstream (what depends on it).

import { RELS } from "./model.js";
import { pad } from "./util.js";

const describe = (doc) => `${doc.id}  ${doc.title}  [${doc.state} · ${doc.status}]`;

function downstream(kb, docId, seen, depth) {
  // Claim all direct dependents first, so a document is shown where it links directly.
  const direct = kb.incomingOf(docId).filter(([, src]) => !seen.has(src));
  for (const [, src] of direct) seen.add(src);
  const nodes = [];
  for (const [rel, src] of direct) {
    const doc = kb.docs.get(src);
    const expand = depth > 1 && doc.state === "authoritative" && doc.type !== "change-request";
    nodes.push([`${pad(RELS[rel] ?? rel, 15)} ${describe(doc)}`, expand ? downstream(kb, src, seen, depth - 1) : []]);
  }
  for (const [rel, kind, target] of kb.docs.get(docId).links()) {
    if (kind === "path") nodes.push([`${pad(rel, 15)} ${target}`, []]);
  }
  return nodes;
}

function render(nodes, prefix = "") {
  const out = [];
  nodes.forEach(([label, children], i) => {
    const last = i === nodes.length - 1;
    out.push(prefix + (last ? "└── " : "├── ") + label);
    out.push(...render(children, prefix + (last ? "    " : "│   ")));
  });
  return out;
}

export function trace(kb, docId, depth, out) {
  const doc = kb.docs.get(docId);
  const idLinks = doc.links().filter(([, kind]) => kind === "id");
  const upstream = idLinks.map(([rel, , target]) => [
    `▲ ${pad(rel, 13)} ${kb.docs.has(target) ? describe(kb.docs.get(target)) : target + "  (missing)"}`, []]);
  const seen = new Set([docId, ...idLinks.map(([, , target]) => target)]);
  out([describe(doc), ...render([...upstream, ...downstream(kb, docId, seen, depth)])].join("\n"));
  out("\n▲ = upstream (why this exists) · unmarked = downstream (what depends on it)");
}
