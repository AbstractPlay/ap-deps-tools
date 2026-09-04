#!/usr/bin/env node
import { runCheck } from "../lib/run-check.mjs";

try {
  runCheck();
} catch (err) {
  console.error(err.message ?? err);
  process.exit(1);
}
