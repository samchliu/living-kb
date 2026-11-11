#!/usr/bin/env node
import { main } from "../src/cli.js";

// `kb ... | head` closes the pipe early: stop quietly instead of crashing with EPIPE.
process.stdout.on("error", (e) => {
  if (e.code === "EPIPE") process.exit(process.exitCode ?? 0);
  throw e;
});
process.exitCode = main(process.argv.slice(2));
