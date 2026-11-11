// Records: `kb seal` and `kb add-ref`.

import fs from "node:fs";
import path from "node:path";
import { FRONT_MATTER, ORIGINALS_DIR, SEAL_BODY_TYPES, TYPES, readFile } from "./model.js";
import { REF_BODY } from "./text.js";
import { dayToIso, format, isFile, readText, sha256File, sha256Text, shown } from "./util.js";

/** Remove write permission. A speed bump only - git does not keep it; the hashes are the real guard. */
function readOnly(file) {
  fs.chmodSync(file, fs.statSync(file).mode & ~0o222);
}

function sameFiles(a, b) {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => b[k] === a[k]);
}

/** Write `seal:` into the record's front matter. Never blesses an unexplained change. Returns an exit code. */
export function seal(doc, today, t, reseal, io) {
  const msg = t.msg;
  if (!(doc.state === "record" && doc.standalone && Object.hasOwn(TYPES, doc.type))) {
    io.err(msg.seal_not_record);
    return 1;
  }
  const files = doc.files();
  for (const rel of files) {
    if (!isFile(doc.filePath(rel))) {
      io.err(format(msg.file_missing, { p: rel }));
      return 1;
    }
  }
  const hashes = files.map((rel) => [rel, sha256File(doc.filePath(rel))]);
  const body = SEAL_BODY_TYPES.includes(doc.type) ? sha256Text(doc.body) : null;
  const old = doc.seal();
  if (old) {
    if (sameFiles(doc.sealedFiles(), Object.fromEntries(hashes)) && (body === null || String(old.body || "") === body)) {
      io.out(format(msg.seal_ok, { i: doc.id }));
      return 0;
    }
    if (!reseal) {
      io.err(format(msg.seal_refuse, { i: doc.id }));
      return 1;
    }
  }
  const block = ["seal:", "  on: " + dayToIso(today)];
  if (body) block.push("  body: " + body);
  if (hashes.length) {
    block.push("  files:");
    for (const [rel, digest] of hashes) block.push(`    - path: "${rel}"`, "      sha256: " + digest);
  }
  const text = readText(doc.path);
  const match = FRONT_MATTER.exec(text);
  const start = match.index + "---\n".length;
  const end = start + match[1].length;
  const kept = [];
  let skipping = false;
  for (const line of match[1].split("\n")) {
    if (line.startsWith("seal:")) {
      skipping = true;
      continue;
    }
    if (skipping && (line.startsWith(" ") || line.startsWith("\t") || !line.trim())) continue;
    skipping = false;
    kept.push(line);
  }
  while (kept.length && !kept[kept.length - 1].trim()) kept.pop();
  fs.writeFileSync(doc.path, text.slice(0, start) + [...kept, ...block].join("\n") + text.slice(end), "utf8");
  for (const rel of files) readOnly(doc.filePath(rel));
  io.out(format(msg.sealed, { i: doc.id, n: files.length, b: body ? msg.sealed_body : "" }));
  return 0;
}

/** Register external files as a new, sealed REF. Returns an exit code. */
export function addRef(kb, sources, title, source, owner, today, t, lang, io) {
  const msg = t.msg;
  const refDir = path.join(kb.src, "reference");
  const originals = path.join(refDir, ORIGINALS_DIR);
  const numbers = kb.all.filter((d) => /^REF-\d+$/.test(d.id)).map((d) => parseInt(d.id.slice(4), 10));
  if (fs.existsSync(originals)) {
    for (const name of fs.readdirSync(originals)) if (/^REF-\d+$/.test(name)) numbers.push(parseInt(name.slice(4), 10));
  }
  const refId = "REF-" + String(Math.max(0, ...numbers) + 1).padStart(3, "0");
  const dest = path.join(originals, refId);
  const docPath = path.join(refDir, refId + ".md");
  const names = [];
  for (const file of sources) {
    const name = path.basename(file);
    if (!isFile(file)) {
      io.err(format(msg.file_missing, { p: file }));
      return 1;
    }
    if (names.includes(name) || name.includes('"')) {
      io.err(format(msg.ref_exists, { p: name }));
      return 1;
    }
    names.push(name);
  }
  for (const target of [dest, docPath]) {
    if (fs.existsSync(target)) {
      io.err(format(msg.ref_exists, { p: shown(target) }));
      return 1;
    }
  }
  fs.mkdirSync(dest, { recursive: true });
  for (const file of sources) {
    const target = path.join(dest, path.basename(file));
    const st = fs.statSync(file);
    fs.copyFileSync(file, target);
    fs.chmodSync(target, st.mode);
    fs.utimesSync(target, st.atime, st.mtime);
  }
  const quote = (s) => `"${String(s).replaceAll('"', "'")}"`;
  const date = dayToIso(today);
  const meta = ["---", "id: " + refId, "title: " + quote(title), "type: reference", "knowledge_state: record",
    "status: active", "owner: " + owner, `authors: [${owner}]`, "created: " + date,
    "source:", "  from: " + quote(source || ""), "  received: " + date, "files:",
    ...names.map((name) => `  - "${ORIGINALS_DIR}/${refId}/${name}"`),
    "related: []", "---", ""];
  fs.mkdirSync(refDir, { recursive: true });
  fs.writeFileSync(docPath, meta.join("\n") + format(REF_BODY[lang], { id: refId, title }), "utf8");
  io.out(format(msg.added_ref, { i: refId, p: shown(docPath) }));
  const docs = [];
  readFile(docPath, docs, []);
  return seal(docs[0], today, t, false, io);
}
