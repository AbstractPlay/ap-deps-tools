#!/usr/bin/env node
import { runInstall } from "../lib/run-install.mjs";

try {
  runInstall();
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
