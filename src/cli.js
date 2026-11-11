// Command line: argument parsing and the top-level flow.

import path from "node:path";
import { CONFIG_NAME, DEFAULTS, PATH_KEYS, ROOT, findConfig, loadConfig } from "./config.js";
import { KB } from "./model.js";
import { TEXT } from "./text.js";
import { build, BuildError } from "./build.js";
import { loadRoster, printReport, validate } from "./validate.js";
import { trace } from "./trace.js";
import { addRef, seal } from "./records.js";
import { dayToIso, format, isFile, shown, toDay, todayDay } from "./util.js";

const USAGE = `usage: kb <command> [options]

Validate, trace, and build the knowledge base. See BUILD.md.

commands:
  validate                 check every document and print a report
  build                    validate, then regenerate <src>/_build
  trace ID                 upstream (why it exists) and downstream (what depends on it)
  config                   print the resolved configuration
  seal ID                  freeze a record (REF / CLR / RPT)
  add-ref FILE...          register external files as a sealed REF

options (all commands):
  --config FILE            kb.config.yaml to use (default: ./${CONFIG_NAME}, then the one at the framework root)
  --src DIR                knowledge directory (default: \`src\` in the config, else docs/)
  --today YYYY-MM-DD       date used for staleness checks (default: today); pin it for reproducible builds
  --code-root DIR          code root: enables DRIFT / ORPHAN checks against code and per-rule test coverage
  --ownership FILE         roster file (default: \`ownership\` in the config, else OWNERSHIP.md)
  --lang ${Object.keys(TEXT).sort().join("|")}          output language (default: \`lang\` in the config)

validate, build:  --strict (treat warnings as errors)
build:            --out DIR (default: <src>/_build)
trace:            --depth N (default: 3)
seal:             --reseal (re-seal a record whose content changed - a human decided it is correct)
add-ref:          --title TITLE (required)  --source WHO  --owner ROLE (default: PM)`;

const COMMON = { "--config": "value", "--src": "value", "--today": "value", "--code-root": "value", "--ownership": "value", "--lang": "value" };
const COMMANDS = {
  validate: { options: { "--strict": "flag" }, positional: null },
  build: { options: { "--strict": "flag", "--out": "value" }, positional: null },
  trace: { options: { "--depth": "value" }, positional: "one" },
  config: { options: {}, positional: null },
  seal: { options: { "--reseal": "flag" }, positional: "one" },
  "add-ref": { options: { "--title": "value", "--source": "value", "--owner": "value" }, positional: "many" },
};

class UsageError extends Error {}

/** argv -> { command, opts: {"--name": value|true}, positional: [] } */
function parseArgs(argv) {
  const [command, ...rest] = argv;
  if (!command || command === "-h" || command === "--help") return { help: true };
  if (!Object.hasOwn(COMMANDS, command)) throw new UsageError(`invalid command '${command}'`);
  const spec = { ...COMMON, ...COMMANDS[command].options };
  const opts = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];
    if (arg === "-h" || arg === "--help") return { help: true };
    if (arg.startsWith("--")) {
      const [name, inline] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, null];
      if (!spec[name]) throw new UsageError(`unrecognized argument: ${arg}`);
      if (spec[name] === "flag") {
        opts[name] = true;
      } else {
        const value = inline !== null ? inline : rest[++i];
        if (value === undefined) throw new UsageError(`argument ${name}: expected one argument`);
        opts[name] = value;
      }
    } else {
      positional.push(arg);
    }
  }
  const want = COMMANDS[command].positional;
  if (want === null && positional.length) throw new UsageError(`unrecognized arguments: ${positional.join(" ")}`);
  if (want === "one" && positional.length !== 1) throw new UsageError(`${command} needs exactly one ID`);
  if (want === "many" && !positional.length) throw new UsageError(`${command} needs at least one file`);
  if (command === "add-ref" && !opts["--title"]) throw new UsageError("the following arguments are required: --title");
  if (opts["--lang"] && !Object.hasOwn(TEXT, opts["--lang"])) {
    throw new UsageError(`argument --lang: invalid choice: '${opts["--lang"]}'`);
  }
  if (opts["--depth"] !== undefined && !/^-?\d+$/.test(opts["--depth"])) {
    throw new UsageError(`argument --depth: invalid int value: '${opts["--depth"]}'`);
  }
  return { command, opts, positional };
}

function printConfig(cfg, out) {
  out("layers (applied in order, later wins):");
  out("  0. <built-in defaults>  src/config.js");
  cfg.layers.forEach((file, i) => out(`  ${i + 1}. ${shown(file)}`));
  out("resolved:");
  for (const key of Object.keys(DEFAULTS)) {
    let value = cfg[key];
    if (PATH_KEYS.includes(key)) value = shown(value);
    else if (key === "ai_context") value = { instructions: value.instructions, include: value.include.map(shown) };
    out(`  ${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`);
  }
}

const defaultIo = {
  out: (line) => process.stdout.write(line + "\n"),
  err: (line) => process.stderr.write(line + "\n"),
};

/**
 * Run the CLI. Returns the exit code instead of exiting, so tests can call it directly.
 * @param {string[]} argv arguments after `kb`
 * @param {{out: (line: string) => void, err: (line: string) => void}} io
 */
export function main(argv, io = defaultIo) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    if (!(e instanceof UsageError)) throw e;
    io.err(USAGE.split("\n")[0]);
    io.err(`kb: error: ${e.message}`);
    return 2;
  }
  if (args.help) {
    io.out(USAGE);
    return 0;
  }
  const { command, opts, positional } = args;

  const { cfg, errors } = loadConfig(findConfig(opts["--config"]));
  const lang = opts["--lang"] || (Object.hasOwn(TEXT, String(cfg.lang)) ? cfg.lang : DEFAULTS.lang);
  const t = TEXT[lang];
  for (const file of cfg.ai_context.include) {
    if (!isFile(file)) errors.push(["config_missing", cfg.layers.length ? cfg.layers[cfg.layers.length - 1] : ROOT, { k: shown(file) }]);
  }
  if (errors.length) {
    for (const [code, where, kw] of errors) io.err(`  ERROR    CONFIG       ${format(t.msg[code], kw)}   ${shown(where)}`);
    io.err(t.msg.config_failed);
    return 2;
  }
  if (command === "config") {
    printConfig(cfg, io.out);
    return 0;
  }

  let today;
  try {
    today = opts["--today"] ? toDay(opts["--today"]) : todayDay();
  } catch {
    io.err(`kb: error: argument --today: not a YYYY-MM-DD date: '${opts["--today"]}'`);
    return 2;
  }
  const src = opts["--src"] ? path.resolve(opts["--src"]) : cfg.src;
  const kb = new KB(src);
  if (command === "trace" || command === "seal") {
    const id = positional[0];
    if (!kb.docs.has(id)) {
      io.err(format(t.msg.not_found, { i: id }));
      return 1;
    }
    if (command === "trace") {
      trace(kb, id, opts["--depth"] !== undefined ? parseInt(opts["--depth"], 10) : 3, io.out);
      return 0;
    }
    return seal(kb.docs.get(id), today, t, Boolean(opts["--reseal"]), io);
  }
  if (command === "add-ref") {
    return addRef(kb, positional, opts["--title"], opts["--source"], opts["--owner"] || "PM", today, t, lang, io);
  }

  const codeRoot = opts["--code-root"] || null;
  const findings = validate(kb, today, loadRoster(opts["--ownership"] || cfg.ownership), codeRoot, t, cfg);
  printReport(kb, findings, today, dayToIso(today), t, io.out);
  const failed = findings.some((f) => f.severity === "error") || (Boolean(opts["--strict"]) && findings.length > 0);
  if (command === "validate") return failed ? 1 : 0;
  if (failed) {
    io.err(t.msg.build_failed);
    return 1;
  }
  const outDir = opts["--out"] || path.join(src, "_build");
  let count;
  try {
    count = build(kb, findings, outDir, codeRoot, t, cfg);
  } catch (e) {
    if (!(e instanceof BuildError)) throw e;
    io.err(e.message);
    return 1;
  }
  io.out(format(t.msg.built, { n: count, p: shown(outDir) }));
  return 0;
}
