/**
 * @param {string[]} argv
 */
export function parseInstallArgs(argv) {
  let stage = "dev";
  let rendererOnly = false;
  let forTests = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--stage" && argv[i + 1]) {
      stage = argv[++i];
    } else if (argv[i] === "--renderer-only") {
      rendererOnly = true;
    } else if (argv[i] === "--for-tests") {
      forTests = true;
    }
  }
  if (stage !== "dev" && stage !== "prod") {
    throw new Error(`Invalid --stage "${stage}" (expected dev or prod)`);
  }
  return { stage, rendererOnly, forTests };
}

/**
 * @param {string[]} argv
 */
export function parseCheckArgs(argv) {
  let stage = null;
  let strict = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--stage" && argv[i + 1]) {
      stage = argv[++i];
    } else if (argv[i] === "--strict") {
      strict = true;
    }
  }
  if (stage && stage !== "dev" && stage !== "prod") {
    throw new Error(`Invalid --stage "${stage}" (expected dev or prod)`);
  }
  if (strict && !stage) {
    throw new Error("--strict requires --stage dev or prod");
  }
  return { stage, strict };
}
