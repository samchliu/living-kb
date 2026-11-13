// Build targets: feature overviews, QA checklists, AI context, changelog, health report.
// The layout of every artifact is defined here and nowhere else.

import fs from "node:fs";
import path from "node:path";
import { BUILD_MARKER, FRONT_MATTER, HISTORY_CHANGE_COLS, HISTORY_REASON_COLS, HISTORY_VERSION_COLS } from "./model.js";
import { colIndex, demote, mdTable, parseTable, stripComments } from "./markdown.js";
import { overall } from "./validate.js";
import { exportText } from "./export.js";
import { DATE_RE, joinPath, compareTuples, escapeRegExp, format, isDir, isFile, link, readText, stripChars, uniqueSorted } from "./util.js";

export class BuildError extends Error {}

class Writer {
  constructor(outDir) {
    this.outDir = outDir;
    this.count = 0;
  }

  write(rel, lines) {
    const file = path.join(this.outDir, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const text = stripChars(lines.join("\n").replace(/\n{3,}/g, "\n\n"), "\n") + "\n";
    fs.writeFileSync(file, text, "utf8");
    this.count++;
  }
}

function header(t, titleKey, title, sources, here) {
  const built = sources.map((d) => `[${d.id}](${link(d.path, here)})@${d.updated}`).join(" · ");
  const c = t.colon;
  return [`<!-- ${t.notice} -->`, "", `# ${t[titleKey]}${c}${title}`, "",
    "> " + t.not_sot, "", `**${t.built_from}${c.trim()}**${c === ": " ? " " : ""}` + built, ""];
}

/** One source section, re-levelled, with a source-map line pointing back to it. */
function embed(doc, key, here, t, level = 4, titled = true) {
  const found = doc.find(key);
  if (!found) return [];
  const [heading, content] = found;
  const source = `<sub>${t.source}${t.colon}[${doc.id} · ${heading}](${link(doc.path, here)}) · ${doc.status} · ${t.updated} ${doc.updated}</sub>`;
  const title = titled ? ["#".repeat(level) + " " + heading, ""] : [];
  return [...title, source, "", demote(content, titled ? level - 2 : level - 3), ""];
}

const docHeading = (doc, t, level = 3) => ["#".repeat(level) + ` ${doc.id}${t.colon}${doc.title}`, ""];

function chapter(title, blocks, t) {
  const body = blocks.flat();
  return ["## " + title, "", ...(body.length ? body : [t.none, ""])];
}

function historyRows(doc) {
  const rows = [];
  for (const key of ["history", "notes"]) {
    const found = doc.find(key);
    if (!found) continue;
    const [head, body] = parseTable(found[1]);
    const change = colIndex(head, HISTORY_CHANGE_COLS);
    const reason = colIndex(head, HISTORY_REASON_COLS);
    const version = colIndex(head, HISTORY_VERSION_COLS);
    for (const row of body) {
      if (!row.length || !DATE_RE.test(row[0])) continue;
      const pick = (i) => (i !== null && i < row.length ? row[i] : "");
      let text = pick(change !== null ? change : 1);
      if (pick(reason)) text += ` (${pick(reason)})`;
      rows.push([row[0], doc.id, pick(version), text]);
    }
  }
  return rows;
}

function historyTable(docs, t) {
  // newest first; rows with the same (date, doc) keep their order in the source document
  const rows = docs.flatMap(historyRows).map((r, i) => [r, i])
    .sort((a, b) => compareTuples([b[0][0], b[0][1]], [a[0][0], a[0][1]]) || a[1] - b[1])
    .map(([r]) => r);
  if (!rows.length) return [t.none, ""];
  return [mdTable([t.col_date, t.col_doc, t.col_version, t.col_change], rows), ""];
}

function pathRows(docs) {
  const rows = [];
  for (const doc of docs) {
    for (const [rel, kind, target] of doc.links()) {
      if (kind === "path") rows.push([`\`${target}\``, rel, doc.id]);
    }
  }
  return uniqueSorted(rows);
}

function findingsTable(findings, here, t) {
  if (!findings.length) return [t.none, ""];
  const rows = findings.map((f) => [f.severity, f.category, f.docId || "-", f.message,
    f.path ? `[${path.basename(f.path)}](${link(f.path, here)})` : ""]);
  return [mdTable([t.col_sev, t.col_cat, t.col_doc, t.col_msg, t.col_file], rows), ""];
}

const docLink = (d, here) => `[${d.id}](${link(d.path, here)})`;

function buildOverview(kb, req, related, findings, here, t) {
  const of = (kind) => related.filter((d) => d.type === kind);
  const exploratory = related.filter((d) => d.state === "exploratory");
  const crs = of("change-request");
  const ids = new Set([req.id, ...related.map((d) => d.id)]);
  let lines = header(t, "overview_title", `${req.title} (${req.id})`, [req, ...related], here);
  lines = lines.concat(chapter(t.ch_what, ["problem", "goal", "users", "scope", "constraints"].map((k) => embed(req, k, here, t, 3)), t));
  lines = lines.concat(chapter(t.ch_ac, [embed(req, "ac", here, t, 3, false)], t));
  lines = lines.concat(chapter(t.ch_rules, of("business-rule").map((d) => [...docHeading(d, t), ...embed(d, "rules", here, t),
    ...embed(d, "params", here, t), ...embed(d, "rationale", here, t)]), t));
  lines = lines.concat(chapter(t.ch_decisions, of("adr").map((d) => [...docHeading(d, t), ...embed(d, "decision", here, t),
    ...embed(d, "tradeoffs", here, t)]), t));
  lines = lines.concat(chapter(t.ch_arch, of("architecture").map((d) => [...docHeading(d, t), ...embed(d, "overview", here, t),
    ...embed(d, "components", here, t)]), t));
  lines = lines.concat(chapter(t.ch_api, of("api").map((d) => [...docHeading(d, t), ...embed(d, "endpoint", here, t),
    ...embed(d, "request", here, t), ...embed(d, "response", here, t), ...embed(d, "errors", here, t)]), t));
  const paths = pathRows([req, ...related.filter((d) => d.state === "authoritative")]);
  lines = lines.concat(chapter(t.ch_impl, paths.length ? [[mdTable([t.col_path, t.col_rel, t.col_via], paths), ""]] : [], t));
  let status = embed(req, "open", here, t, 3);
  status.push("### " + t.crs, "");
  status = status.concat(crs.length
    ? [mdTable([t.col_doc, t.col_title, t.col_status, t.col_updated], crs.map((d) => [docLink(d, here), d.title, d.status, d.updated])), ""]
    : [t.none, ""]);
  status = status.concat(["### " + t.health, ""], findingsTable(findings.filter((f) => ids.has(f.docId)), here, t));
  lines = lines.concat(chapter(t.ch_status, [status], t));
  let background = [];
  if (exploratory.length) {
    background = ["> " + t.background_note, "",
      mdTable([t.col_doc, t.col_type, t.col_title, t.col_status, t.col_conf],
        exploratory.map((d) => [docLink(d, here), d.type, d.title, d.status, d.get("confidence") || ""])), ""];
  }
  const records = related.filter((d) => d.state === "record");
  if (records.length) {
    background = background.concat(["### " + t.records, "", "> " + t.records_note, "",
      mdTable([t.col_doc, t.col_type, t.col_title, t.col_status, t.col_files, t.col_sealed],
        records.map((d) => [docLink(d, here), d.type, d.title, d.status,
          d.files().map((f) => `[${path.basename(f)}](${link(d.filePath(f), here)})`).join(" · "),
          d.seal() ? String(d.seal().on || "✓") : "—"])), ""]);
  }
  lines = lines.concat(chapter(t.ch_background, background.length ? [background] : [], t));
  lines = lines.concat(["## " + t.ch_history, ""], historyTable([req, ...related.filter((d) => d.state === "authoritative")], t));
  return lines;
}

function ruleCoverage(doc, codeRoot, t) {
  const tests = doc.links().filter(([rel, kind]) => kind === "path" && rel === "verified_by").map(([, , target]) => target);
  if (!tests.length) return [`- ⚠ **${doc.id}**: ${t.qa_no_tests}`];
  const lines = [`- **${doc.id}**: ` + tests.map((p) => `\`${p}\``).join(", ")];
  const found = doc.find("rules");
  const ruleIds = found ? parseTable(found[1])[1].map((r) => r[0]) : [];
  if (!codeRoot) return [...lines, `  - _${t.qa_rule_unknown}_`];
  const texts = new Map();
  for (const p of tests) {
    const full = joinPath(codeRoot, String(p));
    const files = isFile(full) ? [full] : isDir(full) ? listFiles(full) : [];
    for (const fp of files) {
      try {
        texts.set(p, (texts.get(p) || "") + fs.readFileSync(fp, "utf8"));
      } catch {
        // unreadable: treat as empty
      }
    }
  }
  const idPattern = doc.id.replaceAll("-", "[-_]");
  for (const rule of ruleIds) {
    const pattern = new RegExp(`${idPattern}[#_ .-]?${escapeRegExp(rule)}(?![0-9])`);
    const hits = [...texts].filter(([, text]) => pattern.test(text)).map(([p]) => p).sort();
    lines.push(`  - ${hits.length ? "✅" : "⚠"} ${rule}: ` + (hits.length
      ? `${t.qa_rule_found} ${hits.map((h) => `\`${h}\``).join(", ")}`
      : t.qa_rule_missing));
  }
  return lines;
}

function listFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

function buildQa(kb, req, related, here, codeRoot, t) {
  const rules = related.filter((d) => d.type === "business-rule");
  let lines = header(t, "qa_title", `${req.title} (${req.id})`, [req, ...rules], here);
  lines.push(t.qa_intro, "", "## " + t.qa_ac, "");
  const ac = req.find("ac");
  const rows = ac ? parseTable(ac[1])[1] : [];
  const items = rows.map((r) => `- [ ] **${r[0]}** ${r.length > 1 ? r[1] : ""} _(${r.slice(2).join(" · ")})_`);
  lines = lines.concat(items.length ? items : [t.none]);
  lines.push("", "## " + t.qa_examples, "");
  let anyExample = false;
  for (const doc of rules) {
    const found = doc.find("examples");
    for (const r of found ? parseTable(found[1])[1] : []) {
      anyExample = true;
      const text = r.length >= 4 ? `${r[1]} → ${r[2]} (${r[3]})` : r.slice(1).join(" · ");
      lines.push(`- [ ] **${doc.id} ${r[0]}** ${text}`);
    }
  }
  if (!anyExample) lines.push(t.none);
  lines.push("", "## " + t.qa_coverage, "");
  for (const doc of rules) lines = lines.concat(ruleCoverage(doc, codeRoot, t));
  return rules.length ? [...lines, ""] : [...lines, t.none];
}

/** Profile / project standards injected into every AI context (ai_context.include). */
function standards(cfg, here, t) {
  const blocks = [];
  for (const file of cfg.ai_context.include) {
    let text;
    try {
      text = readText(file);
    } catch {
      continue; // reported once by the CLI, not per feature
    }
    const match = FRONT_MATTER.exec(text);
    text = stripComments(match ? text.slice(match[0].length) : text);
    blocks.push([`<sub>${t.source}${t.colon}[${path.basename(file)}](${link(file, here)})</sub>`, "", demote(text, 2), ""]);
  }
  return blocks;
}

function buildContext(kb, req, related, here, t, cfg) {
  const auth = related.filter((d) => d.state === "authoritative" && d.type !== "change-request");
  const refs = related.filter((d) => d.type === "reference" && !["deprecated", "archived"].includes(d.status));
  const of = (kind) => auth.filter((d) => d.type === kind);
  let lines = header(t, "ctx_title", `${req.title} (${req.id})`, [req, ...auth], here);
  lines.push(t.ctx_intro, "", "## " + t.ctx_instructions, "");
  lines = lines.concat([...t.ctx_rules, ...cfg.ai_context.instructions].map((rule) => "- " + rule), [""]);
  const blocks = standards(cfg, here, t);
  if (blocks.length) lines = lines.concat(chapter(t.ctx_standards, blocks, t));
  lines = lines.concat(chapter(t.ctx_scope, [embed(req, "scope", here, t, 3, false)], t));
  lines = lines.concat(chapter(t.ctx_ac, [embed(req, "ac", here, t, 3, false)], t));
  lines = lines.concat(chapter(t.ctx_rules_h, of("business-rule").map((d) => [...docHeading(d, t), ...embed(d, "rules", here, t),
    ...embed(d, "params", here, t), ...embed(d, "examples", here, t)]), t));
  lines = lines.concat(chapter(t.ctx_decisions, of("adr").map((d) => [...docHeading(d, t), ...embed(d, "decision", here, t),
    ...embed(d, "consequences", here, t)]), t));
  lines = lines.concat(chapter(t.ctx_arch, of("architecture").map((d) => [...docHeading(d, t), ...embed(d, "overview", here, t),
    ...embed(d, "components", here, t)]), t));
  lines = lines.concat(chapter(t.ctx_api, of("api").map((d) => [...docHeading(d, t), ...embed(d, "endpoint", here, t),
    ...embed(d, "request", here, t), ...embed(d, "response", here, t), ...embed(d, "errors", here, t)]), t));
  const paths = pathRows([req, ...auth]);
  lines = lines.concat(chapter(t.ctx_code, paths.length ? [[mdTable([t.col_path, t.col_rel, t.col_via], paths), ""]] : [], t));
  if (refs.length) {
    lines = lines.concat(chapter(t.ctx_refs, [["> " + t.ctx_refs_note, "", ...refs.map((d) => {
      const files = d.files().map((f) => `[\`${path.basename(f)}\`](${link(d.filePath(f), here)})`).join(", ");
      return `- **${d.id} ${d.title}**${t.colon}${files || docLink(d, here)}`;
    }), ""]], t));
  }
  lines = lines.concat(chapter(t.ctx_owners, [[mdTable([t.col_doc, t.col_title, t.col_owner],
    [req, ...auth].map((d) => [d.id, d.title, d.owner])), ""]], t));
  lines = lines.concat(chapter(t.ctx_open, [embed(req, "open", here, t, 3, false)], t));
  return lines;
}

/**
 * Empty outDir for a fresh write: delete it if kb made it (it holds BUILD_MARKER), refuse if it holds
 * anything else. Throws BuildError.
 */
export function prepareOutDir(outDir, t, command = "build") {
  if (fs.existsSync(outDir)) {
    if (fs.existsSync(path.join(outDir, BUILD_MARKER))) fs.rmSync(outDir, { recursive: true, force: true });
    else if (fs.readdirSync(outDir).length) throw new BuildError(format(t.msg.out_not_build, { p: outDir }));
  }
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, BUILD_MARKER),
    `Created by \`kb ${command}\`. This whole directory is deleted and regenerated on every ${command}.\n`, "utf8");
}

/** Regenerate outDir. Returns the number of files written. Throws BuildError if outDir is not a kb build folder. */
export function build(kb, findings, outDir, codeRoot, t, cfg) {
  prepareOutDir(outDir, t);
  const w = new Writer(outDir);
  const docs = kb.sortedDocs();
  const requirements = docs.filter((d) => d.type === "requirement" && !["deprecated", "archived"].includes(d.status));

  const index = [`<!-- ${t.notice} -->`, "", "# " + t.index_title, "", t.idx_intro, "",
    `**${t.idx_status}${t.colon.trim()}** ${overall(findings)}`, "", "## " + t.idx_features, ""];
  for (const req of requirements) {
    const related = kb.feature(req);
    const folder = path.join(outDir, "features", req.id);
    w.write(path.join("features", req.id, "overview.md"), buildOverview(kb, req, related, findings, folder, t));
    w.write(path.join("features", req.id, "qa-checklist.md"), buildQa(kb, req, related, folder, codeRoot, t));
    w.write(path.join("features", req.id, "ai-context.md"), buildContext(kb, req, related, folder, t, cfg));
    index.push(`- **${req.id} ${req.title}** · [${t.artifact_overview}](features/${req.id}/overview.md) · `
      + `[${t.artifact_qa}](features/${req.id}/qa-checklist.md) · [${t.artifact_ctx}](features/${req.id}/ai-context.md)`);
  }
  if (!requirements.length) index.push(t.none);
  index.push("", "## " + t.idx_global, "",
    `- [${t.changelog_title}](changelog.md)`,
    `- [${t.health_title}](health.md)`,
    `- [${t.export.title}](kb-export.md)`, "",
    "## " + t.idx_sources, "",
    docs.length
      ? mdTable([t.col_doc, t.col_title, t.col_type, t.col_status, t.col_updated],
        docs.map((d) => [`[${d.id}](${link(d.path, outDir)})`, d.title, d.type, d.status, d.updated]))
      : t.none);
  w.write("README.md", index);
  w.write("changelog.md", [`<!-- ${t.notice} -->`, "", "# " + t.changelog_title, "", ...historyTable(docs, t)]);
  w.write("kb-export.md", [exportText(kb, t)]);
  w.write("health.md", [`<!-- ${t.notice} -->`, "", `# ${t.health_title}${t.colon}${overall(findings)}`, "",
    ...findingsTable(findings, outDir, t)]);
  return w.count;
}
