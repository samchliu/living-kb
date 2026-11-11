// Tests for kb. Zero dependencies, Node 18.17+:
//
//     npm test            (or: node --test tests/)
//
// Every test works in its own temporary directory and never touches the repository.

import { describe, test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main } from "../src/cli.js";
import { loadConfig, DEFAULTS, ROOT as KB_ROOT, CONFIG_NAME } from "../src/config.js";
import { KB, REQUIRED, FRONT_MATTER, readFile } from "../src/model.js";
import { parseYaml } from "../src/yaml.js";
import { validate } from "../src/validate.js";
import { TEXT } from "../src/text.js";
import { sha256File, toDay } from "../src/util.js";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const EXAMPLE = path.join(ROOT, "examples", "pos-recommendation");
const EXAMPLE_TODAY = "2026-09-16"; // the date the committed sample _build/ was generated with
const TODAY = "2026-11-10";
const EN = TEXT.en;

const dedent = (text) => {
  const lines = text.replace(/^\n/, "").split("\n");
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length));
  return lines.map((l) => l.slice(indent)).join("\n");
};
const front = (meta, body = "") => "---\n" + dedent(meta).trim() + "\n---\n" + (body ? dedent(body).replace(/^\n+/, "") : "");

const REQ = front(`
  id: REQ-001
  title: Checkout
  type: requirement
  knowledge_state: authoritative
  status: active
  owner: PM
  created: 2026-11-01
  updated: 2026-11-05
  last_reviewed: 2026-11-05
  approved_by: {who: PM, date: 2026-11-05}
  `, `
  # REQ-001: Checkout

  ## Scope

  Pay for the cart.

  ## Acceptance criteria

  | # | Criterion |
  |---|---|
  | AC1 | The customer can pay |
  `);

const apiDoc = (rel) => front(`
  id: API-001
  title: POST /pay
  type: api
  knowledge_state: authoritative
  status: active
  owner: RD
  created: 2026-11-01
  updated: 2026-11-05
  last_reviewed: 2026-11-10
  approved_by: {who: RD, date: 2026-11-05}
  related:
    - { id: REQ-001, rel: implements }
    - { id: REF-001, rel: ${rel} }
  `, "# API-001\n");

const clrDoc = (rows, { status = "draft", created = "2026-11-01" } = {}) => front(`
  id: CLR-001
  title: Questions for the customer
  type: clarification
  knowledge_state: record
  status: ${status}
  owner: RD
  created: ${created}
  `, `
  # CLR-001

  ## Questions

  | # | Question | Ask | Status | Answer | Landed in |
  |---|---|---|---|---|---|
  `) + rows.join("\n") + "\n";

const rptDoc = (measuredOn, status = "active") => front(`
  id: RPT-001
  title: Load test
  type: report
  knowledge_state: record
  status: ${status}
  owner: RD
  created: ${measuredOn}
  measured_on: ${measuredOn}
  files:
    - "_originals/RPT-001/k6.json"
  related:
    - { id: REQ-001, rel: evidence_for }
  `, `
  # RPT-001

  ## Results

  p95 = 280ms
  `);

/** A throwaway project: kb.config.yaml + docs/ in a temp dir. */
class Project {
  constructor(t) {
    this.dir = fs.mkdtempSync(path.join(os.tmpdir(), "kb-test-"));
    t.after(() => this.cleanup());
    this.config = this.write("kb.config.yaml", "");
    this.docs = path.join(this.dir, "docs");
    fs.mkdirSync(this.docs);
  }

  cleanup() {
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else fs.chmodSync(p, 0o600);
      }
    };
    walk(this.dir);
    fs.rmSync(this.dir, { recursive: true, force: true });
  }

  path(rel) { return path.join(this.dir, rel); }

  write(rel, text) {
    const p = this.path(rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    if (fs.existsSync(p)) fs.chmodSync(p, 0o600);
    fs.writeFileSync(p, text, "utf8");
    return p;
  }

  read(rel) { return fs.readFileSync(this.path(rel), "utf8"); }

  append(rel, text) { this.write(rel, this.read(rel) + text); }

  /** Run the CLI -> { code, out, err }. */
  run(...argv) {
    const out = [];
    const err = [];
    const code = main([...argv, "--config", this.config, "--lang", "en", "--today", TODAY],
      { out: (l) => out.push(l), err: (l) => err.push(l) });
    return { code, out: out.join("\n"), err: err.join("\n") };
  }

  findings(today = TODAY) {
    const { cfg, errors } = loadConfig(this.config);
    assert.deepEqual(errors, []);
    return validate(new KB(cfg.src), toDay(today), null, null, EN, cfg);
  }

  addRef(name = "spec.docx", content = "original", title = "Customer API spec") {
    const source = this.write(path.join("inbox", name), content);
    const r = this.run("add-ref", source, "--title", title, "--source", "Customer X");
    assert.equal(r.code, 0, r.out + r.err);
    return r.out;
  }
}

const matching = (findings, severity, category, docId = null, text = null) => findings.filter((f) =>
  f.severity === severity && f.category === category && (docId === null || f.docId === docId)
  && (text === null || f.message.includes(text)));

function assertFinding(findings, severity, category, docId = null, text = null) {
  assert.ok(matching(findings, severity, category, docId, text).length,
    `no ${severity} ${category} ${docId} ${JSON.stringify(text)} in:\n`
    + findings.map((f) => `  ${f.severity} ${f.category} ${f.docId} ${f.message}`).join("\n"));
}

function assertNoFinding(findings, severity, category, docId = null, text = null) {
  const found = matching(findings, severity, category, docId, text);
  assert.equal(found.length, 0, "unexpected: " + found.map((f) => f.message).join("; "));
}

const assertNoErrors = (findings) => assert.deepEqual(findings.filter((f) => f.severity === "error").map((f) => f.message), []);

const quiet = { out: () => {}, err: () => {} };

// ── Regression: the knowledge model and build output did not change ────────────

describe("example build", () => {
  function buildExample(t) {
    const work = fs.mkdtempSync(path.join(os.tmpdir(), "kb-example-"));
    t.after(() => fs.rmSync(work, { recursive: true, force: true }));
    const src = path.join(work, "pos-recommendation");
    fs.cpSync(EXAMPLE, src, { recursive: true, filter: (p) => path.basename(p) !== "_build" });
    const empty = path.join(work, "kb.config.yaml");
    fs.writeFileSync(empty, "");
    const code = main(["build", "--src", src, "--today", EXAMPLE_TODAY, "--config", empty,
      "--ownership", path.join(ROOT, "OWNERSHIP.md")], quiet);
    assert.equal(code, 0);
    return path.join(src, "_build");
  }

  const tree = (folder) => {
    const out = {};
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else out[path.relative(folder, p)] = fs.readFileSync(p, "utf8");
      }
    };
    walk(folder);
    return out;
  };

  test("matches the committed sample (golden output)", (t) => {
    const expected = tree(path.join(EXAMPLE, "_build"));
    const actual = tree(buildExample(t));
    assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort());
    for (const name of Object.keys(expected)) assert.equal(actual[name], expected[name], name);
  });

  test("is deterministic", (t) => {
    assert.deepEqual(tree(buildExample(t)), tree(buildExample(t)));
  });

  test("example is healthy", () => {
    const { cfg } = loadConfig(null);
    const findings = validate(new KB(EXAMPLE), toDay(EXAMPLE_TODAY), null, null, EN, cfg);
    assert.deepEqual(findings.map((f) => f.message), []);
  });
});

// ── Configuration: kb.config.yaml + extends ────────────────────────────────────

describe("config", () => {
  let p;
  beforeEach((t) => { p = new Project(t); });
  const load = () => loadConfig(p.config);
  const assertConfigError = (code) => {
    const { errors } = load();
    assert.ok(errors.map((e) => e[0]).includes(code), JSON.stringify(errors));
  };
  const names = (cfg) => cfg.layers.map((f) => path.basename(f));

  test("no config means built-in defaults", () => {
    const { cfg, errors } = loadConfig(null);
    assert.deepEqual(errors, []);
    assert.deepEqual(cfg.review_days, DEFAULTS.review_days);
    assert.equal(cfg.src, path.join(KB_ROOT, "docs"));
  });

  test("merge rules", () => {
    p.write("profiles/org/profile.yaml", "review_days: {api: 60, requirement: 30}\ncode_exts: [.mdx]\ncr_open_days: 7\nneeds_approval: [operations]\n");
    p.write("kb.config.yaml", "extends: [profiles/org]\nreview_days: {api: 45}\ncode_exts: [.mdx, .astro]\ncr_open_days: 21\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.equal(cfg.review_days.api, 45); // later layer wins
    assert.equal(cfg.review_days.requirement, 30); // maps merge key by key
    assert.equal(cfg.review_days.architecture, 180); // default kept
    assert.deepEqual(cfg.code_exts.slice(-2), [".mdx", ".astro"]); // lists: union, no duplicates
    assert.ok(cfg.code_exts.includes(".py"));
    assert.equal(cfg.cr_open_days, 21);
    assert.ok(cfg.needs_approval.includes("operations"));
    assert.deepEqual(names(cfg), ["profile.yaml", "kb.config.yaml"]);
  });

  test("`key!:` replaces instead of merging", () => {
    p.write("kb.config.yaml", "needs_approval!: [adr]\nreview_days!: {api: 10}\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.deepEqual(cfg.needs_approval, ["adr"]);
    assert.deepEqual(cfg.review_days, { api: 10 });
  });

  test("review_days: never", () => {
    p.write("kb.config.yaml", "review_days: {operations: never, api: 30d}\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.equal(cfg.review_days.operations, null);
    assert.equal(cfg.review_days.api, 30);
  });

  test("paths resolve relative to the declaring file", () => {
    p.write("shared/org/profile.yaml", "ai_context:\n  include: [std.md]\n");
    p.write("shared/org/std.md", "# Std\n");
    p.write("kb.config.yaml", "extends: [shared/org]\nsrc: knowledge\nownership: team/OWNERSHIP.md\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.deepEqual(cfg.ai_context.include, [p.path("shared/org/std.md")]);
    assert.equal(cfg.src, p.path("knowledge"));
    assert.equal(cfg.ownership, p.path("team/OWNERSHIP.md"));
  });

  test("extends a .yaml file", () => {
    p.write("org.yaml", "cr_open_days: 3\n");
    p.write("kb.config.yaml", "extends: [org.yaml]\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.equal(cfg.cr_open_days, 3);
  });

  test("diamond applies a shared profile once", () => {
    p.write("base.yaml", "code_exts: [.base]\ncr_open_days: 1\n");
    p.write("a.yaml", "extends: [base.yaml]\ncode_exts: [.a]\n");
    p.write("b.yaml", "extends: [base.yaml]\ncode_exts: [.b]\ncr_open_days: 2\n");
    p.write("kb.config.yaml", "extends: [a.yaml, b.yaml]\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.deepEqual(names(cfg), ["base.yaml", "a.yaml", "b.yaml", "kb.config.yaml"]);
    assert.deepEqual(cfg.code_exts.slice(-3), [".base", ".a", ".b"]);
    assert.equal(cfg.cr_open_days, 2); // base must not be re-applied after b
  });

  test("invariants cannot be configured", () => {
    for (const key of ["types", "knowledge_states", "statuses", "relations", "evidence_rels"]) {
      p.write("kb.config.yaml", `${key}: [x]\n`);
      assertConfigError("config_locked");
    }
  });

  test("required_fields can grow but not shrink", () => {
    p.write("kb.config.yaml", "required_fields: [tags]\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.deepEqual(cfg.required_fields, [...REQUIRED, "tags"]);
    p.write("kb.config.yaml", "required_fields!: [id]\n");
    assertConfigError("config_shrink");
  });

  test("unknown keys", () => {
    p.write("kb.config.yaml", "review_dayz: {api: 3}\n");
    assertConfigError("config_unknown");
    p.write("kb.config.yaml", "ai_context: {instruction: [x]}\n");
    assertConfigError("config_unknown");
    p.write("kb.config.yaml", "constructor: x\n"); // must not match Object.prototype
    assertConfigError("config_unknown");
  });

  test("bad values", () => {
    for (const text of ["needs_approval: [nope]\n", "review_days: {nope: 3}\n", "review_days: {api: soon}\n",
      "cr_open_days: soon\n", "lang: fr\n", "needs_approval: [toString]\n"]) {
      p.write("kb.config.yaml", text);
      assertConfigError("config_bad");
    }
  });

  test("cycle", () => {
    p.write("a.yaml", "extends: [kb.config.yaml]\n");
    p.write("kb.config.yaml", "extends: [a.yaml]\n");
    assertConfigError("config_cycle");
  });

  test("missing profile", () => {
    p.write("kb.config.yaml", "extends: [profiles/nope]\n");
    assertConfigError("config_missing");
  });

  test("CLI stops on config errors", () => {
    p.write("kb.config.yaml", "types: [x]\n");
    const r = p.run("validate");
    assert.equal(r.code, 2);
    assert.match(r.err, /cannot be configured/);
    assert.doesNotMatch(r.out, /Knowledge check/);
  });

  test("CLI stops on a missing include", () => {
    p.write("kb.config.yaml", "ai_context: {include: [nope.md]}\n");
    const r = p.run("validate");
    assert.equal(r.code, 2);
    assert.match(r.err, /nope\.md/);
  });

  test("settings change the checks", () => {
    p.write("docs/REQ-001.md", REQ.replace("approved_by: {who: PM, date: 2026-11-05}\n", ""));
    assertFinding(p.findings(), "warning", "MISSING", "REQ-001", "approved_by");
    p.write("kb.config.yaml", "needs_approval!: [adr]\n");
    assertNoFinding(p.findings(), "warning", "MISSING", "REQ-001", "approved_by");
    p.write("kb.config.yaml", "review_days: {requirement: 3}\n");
    assertFinding(p.findings(), "warning", "STALE", "REQ-001");
  });

  test("ai_context is injected into every AI context", () => {
    p.write("std.md", "---\nx: 1\n---\n# Org rules\n\n## UI\n\n- MUST use @company/ui\n");
    p.write("kb.config.yaml", 'ai_context:\n  instructions: ["Amounts are integer cents"]\n  include: [std.md]\n');
    p.write("docs/REQ-001.md", REQ);
    const r = p.run("build");
    assert.equal(r.code, 0, r.out + r.err);
    const ctx = p.read("docs/_build/features/REQ-001/ai-context.md");
    assert.ok(ctx.includes("- Amounts are integer cents"));
    assert.ok(ctx.includes("## Team / organisation standards"));
    assert.ok(ctx.includes("### Org rules")); // demoted under the chapter
    assert.ok(ctx.includes("- MUST use @company/ui"));
    assert.ok(!ctx.includes("x: 1")); // front matter of the included file is dropped
  });

  test("shipped profiles load", () => {
    const shipped = fs.readdirSync(path.join(ROOT, "profiles")).filter((n) => fs.existsSync(path.join(ROOT, "profiles", n, "profile.yaml")));
    assert.deepEqual(shipped.sort(), ["frontend-example", "personal", "small-team"]);
    for (const name of shipped) {
      p.write("kb.config.yaml", `extends: [${path.join(ROOT, "profiles", name)}]\n`);
      const { cfg, errors } = load();
      assert.deepEqual(errors, [], name);
      for (const file of cfg.ai_context.include) assert.ok(fs.existsSync(file), file);
    }
  });

  test("kb:<name> resolves to a shipped profile, wherever the project lives", () => {
    p.write("kb.config.yaml", "extends: [kb:personal]\n");
    const { cfg, errors } = load();
    assert.deepEqual(errors, []);
    assert.equal(cfg.review_days.requirement, 180);
    assert.deepEqual(cfg.layers, [path.join(ROOT, "profiles", "personal", "profile.yaml"), p.config]);
  });

  test("kb:<name> for a profile that does not exist is a config error", () => {
    p.write("kb.config.yaml", "extends: [kb:nope]\n");
    const { errors } = load();
    assert.equal(errors.length, 1);
    assert.equal(errors[0][0], "config_missing");
    assert.ok(errors[0][2].k.includes(path.join("profiles", "nope")));
  });

  test("shipped root config is valid", () => {
    assert.deepEqual(loadConfig(path.join(ROOT, CONFIG_NAME)).errors, []);
  });
});

// ── Records: REF / CLR / RPT, seals ────────────────────────────────────────────

describe("references", () => {
  let p;
  beforeEach((t) => {
    p = new Project(t);
    p.write("docs/REQ-001.md", REQ);
  });

  test("add-ref registers and seals", () => {
    assert.match(p.addRef(), /REF-001/);
    const original = p.path("docs/reference/_originals/REF-001/spec.docx");
    assert.equal(fs.readFileSync(original, "utf8"), "original");
    assert.equal(fs.statSync(original).mode & 0o200, 0); // read-only
    const meta = parseYaml(FRONT_MATTER.exec(p.read("docs/reference/REF-001.md"))[1]);
    assert.deepEqual([meta.type, meta.knowledge_state, meta.status], ["reference", "record", "active"]);
    assert.deepEqual(meta.files, ["_originals/REF-001/spec.docx"]);
    assert.equal(meta.seal.files[0].sha256, sha256File(original));
    assert.ok(!("body" in meta.seal)); // a REF's body is our notes, not sealed
    const findings = p.findings();
    assertNoErrors(findings);
    assertNoFinding(findings, "warning", "MISSING", "REF-001");
  });

  test("ids increment", () => {
    p.addRef("a.docx");
    p.addRef("b.pdf");
    assert.ok(fs.existsSync(p.path("docs/reference/REF-002.md")));
    assert.ok(fs.existsSync(p.path("docs/reference/_originals/REF-002/b.pdf")));
  });

  test("originals are never read as knowledge documents", () => {
    // a customer may send Markdown that looks like ours; it must stay an opaque file
    p.addRef("customer-notes.md", "---\nid: REQ-777\ntitle: Theirs\ntype: requirement\n---\n## x\n```yaml\nid: BR-777\ntype: business-rule\n```\n");
    const kb = new KB(p.docs);
    assert.ok(!kb.docs.has("REQ-777") && !kb.docs.has("BR-777"));
    assertNoErrors(p.findings());
  });

  test("title with quotes and colons", () => {
    p.addRef("spec.docx", "original", 'Spec: "v2" final');
    assert.equal(new KB(p.docs).docs.get("REF-001").title, "Spec: 'v2' final");
  });

  test("a modified original is an error and fails the build", () => {
    p.addRef();
    p.append("docs/reference/_originals/REF-001/spec.docx", " edited");
    assertFinding(p.findings(), "error", "IMMUTABLE", "REF-001", "has been modified");
    assert.equal(p.run("build").code, 1);
    assert.ok(!fs.existsSync(p.path("docs/_build")));
  });

  test("file added or removed after sealing", () => {
    p.addRef();
    const file = "docs/reference/REF-001.md";
    const text = p.read(file);
    p.write("docs/reference/_originals/REF-001/extra.pdf", "x");
    p.write(file, text.replace('files:\n  - "_originals/REF-001/spec.docx"',
      'files:\n  - "_originals/REF-001/spec.docx"\n  - "_originals/REF-001/extra.pdf"'));
    assertFinding(p.findings(), "error", "IMMUTABLE", "REF-001", "added after sealing");
    p.write(file, text.replace('files:\n  - "_originals/REF-001/spec.docx"\n', "files: []\n"));
    assertFinding(p.findings(), "error", "IMMUTABLE", "REF-001", "removed");
  });

  test("missing file", () => {
    p.addRef();
    fs.rmSync(p.path("docs/reference/_originals/REF-001/spec.docx"));
    assertFinding(p.findings(), "error", "BROKEN_LINK", "REF-001", "does not exist");
  });

  test("notes in the body may be edited", () => {
    p.addRef();
    p.append("docs/reference/REF-001.md", "\nAI summary: the spec covers payments.\n");
    assertNoErrors(p.findings());
  });

  test("an unsealed reference is flagged", () => {
    p.write("docs/reference/REF-001.md", front(`
      id: REF-001
      title: Spec
      type: reference
      knowledge_state: record
      status: active
      owner: PM
      `));
    assertFinding(p.findings(), "warning", "MISSING", "REF-001", "not sealed");
  });

  test("authoritative may cite a record only as evidence", () => {
    p.addRef();
    p.write("docs/API-001.md", apiDoc("derived_from"));
    assertNoFinding(p.findings(), "error", "CONFLICT");
    p.write("docs/API-001.md", apiDoc("implements"));
    assertFinding(p.findings(), "error", "CONFLICT", "API-001", "record");
  });

  test("build lists references", () => {
    p.addRef();
    p.write("docs/API-001.md", apiDoc("derived_from"));
    const r = p.run("build");
    assert.equal(r.code, 0, r.out + r.err);
    const ctx = p.read("docs/_build/features/REQ-001/ai-context.md");
    assert.ok(ctx.includes("## External references (originals)"));
    assert.ok(ctx.includes("[`spec.docx`](../../../reference/_originals/REF-001/spec.docx)"));
    const overview = p.read("docs/_build/features/REQ-001/overview.md");
    assert.ok(overview.includes("### Records & external references"));
    assert.ok(overview.includes("[REF-001](../../../reference/REF-001.md)"));
  });
});

describe("seal", () => {
  let p;
  beforeEach((t) => {
    p = new Project(t);
    p.write("docs/REQ-001.md", REQ);
    p.write("docs/records/_originals/RPT-001/k6.json", '{"p95": 280}');
    p.write("docs/records/RPT-001.md", rptDoc("2026-11-08"));
  });

  test("an unsealed final record is flagged", () => {
    assertFinding(p.findings(), "warning", "MISSING", "RPT-001", "not sealed");
  });

  test("a draft record needs no seal yet", () => {
    p.write("docs/records/RPT-001.md", rptDoc("2026-11-08", "draft"));
    assertNoFinding(p.findings(), "warning", "MISSING", "RPT-001");
  });

  test("seal is idempotent", () => {
    let r = p.run("seal", "RPT-001");
    assert.equal(r.code, 0);
    assert.match(r.out, /\+ body/);
    const first = p.read("docs/records/RPT-001.md");
    r = p.run("seal", "RPT-001");
    assert.equal(r.code, 0);
    assert.equal(p.read("docs/records/RPT-001.md"), first);
    assert.match(r.out, /already sealed/);
    assert.equal(first.split("seal:").length - 1, 1);
    assertNoErrors(p.findings());
  });

  test("sealing keeps the rest of the document", () => {
    const before = p.read("docs/records/RPT-001.md");
    p.run("seal", "RPT-001");
    const after = p.read("docs/records/RPT-001.md");
    assert.ok(after.endsWith(before.split("---\n").slice(2).join("---\n"))); // body untouched
    assert.ok(after.includes("measured_on: 2026-11-08\nfiles:")); // metadata untouched
  });

  test("an edited body is an error", () => {
    p.run("seal", "RPT-001");
    p.write("docs/records/RPT-001.md", p.read("docs/records/RPT-001.md").replace("280ms", "250ms"));
    assertFinding(p.findings(), "error", "IMMUTABLE", "RPT-001", "body has been edited");
  });

  test("metadata may change after sealing", () => {
    // superseding a record changes its status, not the record itself
    p.run("seal", "RPT-001");
    p.write("docs/records/RPT-001.md", p.read("docs/records/RPT-001.md").replace("status: active", "status: deprecated"));
    assertNoErrors(p.findings());
  });

  test("refuses to bless a change without --reseal", () => {
    p.run("seal", "RPT-001");
    p.append("docs/records/_originals/RPT-001/k6.json", " ");
    let r = p.run("seal", "RPT-001");
    assert.equal(r.code, 1);
    assert.match(r.err, /Refusing to reseal/);
    assertFinding(p.findings(), "error", "IMMUTABLE", "RPT-001");
    r = p.run("seal", "RPT-001", "--reseal");
    assert.equal(r.code, 0);
    assertNoErrors(p.findings());
  });

  test("only records can be sealed", () => {
    const r = p.run("seal", "REQ-001");
    assert.equal(r.code, 1);
    assert.match(r.err, /only record documents/);
    p.write("docs/REQ-001.md", REQ.replace("owner: PM\n", "owner: PM\nseal: {on: 2026-11-01}\n"));
    assertFinding(p.findings(), "error", "SCHEMA", "REQ-001", "only record documents");
  });

  test("unknown id", () => {
    const r = p.run("seal", "RPT-999");
    assert.notEqual(r.code, 0);
    assert.match(r.err, /RPT-999/);
  });
});

describe("reports", () => {
  let p;
  beforeEach((t) => {
    p = new Project(t);
    p.write("docs/REQ-001.md", REQ); // updated 2026-11-05
    p.write("docs/records/_originals/RPT-001/k6.json", "{}");
  });

  test("outdated when the verified document changed later", () => {
    p.write("docs/records/RPT-001.md", rptDoc("2026-11-01"));
    assertFinding(p.findings(), "warning", "STALE", "RPT-001", "REQ-001");
  });

  test("current when measured after the change", () => {
    p.write("docs/records/RPT-001.md", rptDoc("2026-11-06"));
    assertNoFinding(p.findings(), "warning", "STALE", "RPT-001");
  });

  test("records have no periodic review", () => {
    p.write("docs/records/RPT-001.md", rptDoc("2026-11-06"));
    assertNoFinding(p.findings("2030-01-01"), "warning", "STALE", "RPT-001");
  });
});

describe("clarifications", () => {
  let p;
  beforeEach((t) => {
    p = new Project(t);
    p.write("docs/REQ-001.md", REQ);
  });
  const check = (rows, opts) => {
    p.write("docs/records/CLR-001.md", clrDoc(rows, opts));
    return p.findings();
  };

  test("an answered question must land", () => {
    const findings = check(["| Q1 | a | x | answered | yes | REQ-001 |",
      "| Q2 | b | x | answered | yes | |",
      "| Q3 | c | x | answered | no change | none |"]);
    assertFinding(findings, "warning", "MISSING", "CLR-001", "question Q2 is answered but not landed");
    assertNoFinding(findings, "warning", "MISSING", "CLR-001", "Q1");
    assertNoFinding(findings, "warning", "MISSING", "CLR-001", "Q3");
  });

  test("landed-in IDs must exist", () => {
    assertFinding(check(["| Q1 | a | x | answered | yes | REQ-001, BR-404 |"]), "error", "BROKEN_LINK", "CLR-001", "BR-404");
  });

  test("status values", () => {
    assertFinding(check(["| Q1 | a | x | maybe | | |"]), "warning", "SCHEMA", "CLR-001", "maybe");
    assertNoFinding(check(["| Q1 | a | x | dropped | | |"]), "warning", "SCHEMA", "CLR-001");
  });

  test("open too long", () => {
    const rows = ["| Q1 | a | x | open | | |", "| Q2 | b | x | open | | |"];
    assertFinding(check(rows, { created: "2026-10-01" }), "warning", "MISSING", "CLR-001", "2 unanswered");
    assertNoFinding(check(rows, { created: "2026-11-05" }), "warning", "MISSING", "CLR-001", "unanswered");
  });

  test("the open window is configurable", () => {
    p.write("kb.config.yaml", "clarification_open_days: 60\n");
    assertNoFinding(check(["| Q1 | a | x | open | | |"], { created: "2026-10-01" }), "warning", "MISSING", "CLR-001", "unanswered");
  });

  test("closed with open questions", () => {
    assertFinding(check(["| Q1 | a | x | open | | |"], { status: "active" }), "warning", "MISSING", "CLR-001", "still open");
  });

  test("Chinese headers", () => {
    p.write("docs/records/CLR-001.md", clrDoc(["| Q1 | a | x | answered | yes | |"])
      .replace("## Questions", "## 問題清單")
      .replace("| # | Question | Ask | Status | Answer | Landed in |", "| # | 問題 | 問誰 | 狀態 | 回答 | 落地到 |"));
    assertFinding(p.findings(), "warning", "MISSING", "CLR-001", "Q1");
  });

  test("the template is valid", () => {
    p.addRef(); // the template links to REF-001
    p.write("docs/records/CLR-001.md", fs.readFileSync(path.join(ROOT, "templates", "clarification.md"), "utf8"));
    assertNoErrors(p.findings());
  });
});

describe("templates", () => {
  test("record templates parse with the right type and state", () => {
    for (const name of ["reference", "clarification", "report"]) {
      const docs = [];
      const problems = [];
      readFile(path.join(ROOT, "templates", name + ".md"), docs, problems);
      assert.deepEqual(problems, [], name);
      assert.deepEqual([docs[0].type, docs[0].state], [name, "record"], name);
    }
  });
});

describe("cli", () => {
  test("usage errors exit 2", () => {
    const err = [];
    assert.equal(main(["nope"], { out: () => {}, err: (l) => err.push(l) }), 2);
    assert.equal(main(["validate", "--nope"], quiet), 2);
    assert.equal(main(["add-ref", "x.docx"], quiet), 2); // --title is required
    assert.equal(main(["trace"], quiet), 2);
    assert.equal(main(["validate", "--lang", "fr"], quiet), 2);
    assert.match(err.join("\n"), /invalid command/);
  });

  test("--help exits 0", () => {
    const out = [];
    assert.equal(main(["--help"], { out: (l) => out.push(l), err: () => {} }), 0);
    assert.match(out.join("\n"), /usage: kb/);
  });

  test("--option=value form", (t) => {
    const p = new Project(t);
    p.write("docs/REQ-001.md", REQ);
    const out = [];
    const code = main(["validate", `--config=${p.config}`, "--today=2026-11-10", "--lang=en"],
      { out: (l) => out.push(l), err: () => {} });
    assert.equal(code, 0);
    assert.match(out.join("\n"), /today 2026-11-10/);
  });

  test("an invalid --today exits 2", (t) => {
    const p = new Project(t);
    assert.equal(main(["validate", "--config", p.config, "--today", "2026-02-30"], quiet), 2);
  });
});
