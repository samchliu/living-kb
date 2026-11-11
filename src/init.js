// `kb init`: scaffold a knowledge repo. Never overwrites an existing file.

import fs from "node:fs";
import path from "node:path";
import { CONFIG_NAME, ROOT } from "./config.js";
import { format, isDir, isFile, readText } from "./util.js";

export const CI_CHOICES = ["gitlab", "github", "none"];

const GITIGNORE = ["docs/_build/", "node_modules/"];

const KNOWLEDGE_DIRS = ["exploration", "product", "requirements", "business-rules", "architecture", "decisions", "api", "operations", "reference", "records"];

/** Shipped profiles: folders under profiles/ that hold a profile.yaml. */
export function shippedProfiles() {
  const dir = path.join(ROOT, "profiles");
  return fs.readdirSync(dir).filter((n) => isFile(path.join(dir, n, "profile.yaml"))).sort();
}

function config(profile) {
  const extendsBlock = profile
    ? `extends:\n  - kb:${profile}\n`
    : `# extends:\n${shippedProfiles().map((n) => `#   - kb:${n}`).join("\n")}\n`;
  return `# kb.config.yaml - created by \`kb init\`.
# Every available key, with comments: node_modules/living-kb/kb.config.yaml
# Inspect the merged result: npx kb config

${extendsBlock}
# lang: zh-TW
# src: docs
# ownership: OWNERSHIP.md
`;
}

const GITLAB_CI = `image: node:22

knowledge:validate:
  stage: test
  script:
    - npm ci
    - npx kb validate          # add --strict once the backlog is clean
  rules:
    - if: $CI_PIPELINE_SOURCE == "merge_request_event"
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH

knowledge:build:
  stage: deploy
  script:
    - npm ci
    - npx kb build
  artifacts:
    paths: [docs/_build/]
  rules:
    - if: $CI_COMMIT_BRANCH == $CI_DEFAULT_BRANCH
`;

const GITHUB_CI = `name: knowledge

on:
  push:
    branches: [main]
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: "22"
      - run: npm ci
      - run: npx kb validate     # add --strict once the backlog is clean
      - run: npx kb build
      - uses: actions/upload-artifact@v4
        with:
          name: knowledge-build
          path: docs/_build/
`;

const CODEOWNERS = `# Sealed originals (REF / CLR / RPT) change only with the record owner's approval.
# Replace @pm with the real handle from OWNERSHIP.md.
/docs/**/_originals/ @pm
`;

/**
 * Where links into the framework should point from `dir`: the real install when it lives inside
 * `dir` (node_modules/living-kb, possibly hoisted), else the standard install location - never an
 * absolute path that only exists on this machine.
 */
function frameworkDir(dir) {
  const rel = path.relative(dir, ROOT);
  return rel && !rel.startsWith("..") && !path.isAbsolute(rel) ? ROOT : path.join(dir, "node_modules", "living-kb");
}

/**
 * Rewrite relative Markdown links of a file copied from the framework so they keep pointing at
 * the same target: a sibling that is also scaffolded stays relative, anything else points into
 * the installed framework.
 */
function relink(text, srcFile, destFile, scaffolded, framework) {
  return text.replace(/\]\(([^)\s#]+)(#[^)\s]*)?\)/g, (whole, target, hash = "") => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("/")) return whole;
    const abs = path.resolve(path.dirname(srcFile), target);
    const rel = path.relative(ROOT, abs);
    if (scaffolded.has(rel)) return whole;
    let link = path.relative(path.dirname(destFile), path.join(framework, rel)).split(path.sep).join("/");
    if (!link.startsWith(".")) link = "./" + link;
    return `](${link}${hash})`;
  });
}

/**
 * Scaffold `dir`. Returns an exit code.
 * @param {string} dir target directory (created if missing)
 * @param {string|null} profile shipped profile name, or null for none
 * @param {string} ci one of CI_CHOICES
 */
export function init(dir, profile, ci, t, io) {
  const msg = t.msg;
  if (profile && !shippedProfiles().includes(profile)) {
    io.err(format(msg.init_bad_profile, { p: profile, l: shippedProfiles().join(", ") }));
    return 2;
  }
  if (fs.existsSync(dir) && !isDir(dir)) {
    io.err(format(msg.init_not_dir, { p: dir }));
    return 2;
  }
  const copies = ["OWNERSHIP.md", "docs/README.md", ...KNOWLEDGE_DIRS.map((d) => `docs/${d}/README.md`)];
  const scaffolded = new Set(copies);
  const framework = frameworkDir(dir);
  const files = [[CONFIG_NAME, config(profile)]];
  for (const rel of copies) {
    const src = path.join(ROOT, rel);
    files.push([rel, relink(readText(src), src, path.join(dir, rel), scaffolded, framework)]);
  }
  const prTemplate = readText(path.join(ROOT, "templates", "pr-template.md"));
  if (ci === "gitlab") {
    files.push([".gitlab-ci.yml", GITLAB_CI], [".gitlab/merge_request_templates/Default.md", prTemplate], [".gitlab/CODEOWNERS", CODEOWNERS]);
  } else if (ci === "github") {
    files.push([".github/workflows/knowledge.yml", GITHUB_CI], [".github/pull_request_template.md", prTemplate], [".github/CODEOWNERS", CODEOWNERS]);
  }

  for (const [rel, content] of files) {
    const dest = path.join(dir, rel);
    if (fs.existsSync(dest)) {
      io.out(format(msg.init_skipped, { p: rel }));
      continue;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
    io.out(format(msg.init_created, { p: rel }));
  }

  const ignore = path.join(dir, ".gitignore");
  const have = isFile(ignore) ? readText(ignore) : "";
  const lines = new Set(have.split("\n").map((l) => l.trim()));
  const missing = GITIGNORE.filter((l) => !lines.has(l) && !lines.has("/" + l));
  if (missing.length) {
    fs.writeFileSync(ignore, have + (have && !have.endsWith("\n") ? "\n" : "") + missing.join("\n") + "\n");
    io.out(format(have ? msg.init_appended : msg.init_created, { p: ".gitignore" }));
  } else {
    io.out(format(msg.init_skipped, { p: ".gitignore" }));
  }
  io.out("");
  io.out(msg.init_next);
  return 0;
}
