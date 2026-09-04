import fs from "fs";
import { AP_PACKAGES, MANIFEST_KEYS } from "./constants.mjs";
import { readJson } from "./fs-utils.mjs";
import { getLockfileVersions } from "./lockfile-versions.mjs";
import {
  ciDepsPath,
  legacyCiDepsPath,
  packageJsonPath,
} from "./paths.mjs";
import { parseCheckArgs } from "./parse-args.mjs";
import { detectProfile } from "./profile.mjs";

function fail(message) {
  console.error(`check-ci-deps: ${message}`);
  process.exit(1);
}

function warn(message) {
  console.warn(`check-ci-deps: warning: ${message}`);
}

/**
 * @param {string} [root]
 * @param {string[]} [argv]
 */
export function runCheck(root = process.cwd(), argv = process.argv) {
  const { stage: checkStage, strict } = parseCheckArgs(argv);

  if (fs.existsSync(legacyCiDepsPath(root))) {
    fail("remove legacy ci-deps.json; use ci-deps.dev.json and ci-deps.prod.json");
  }

  const stages = ["dev", "prod"];
  /** @type {Record<string, object>} */
  const manifests = {};

  for (const stage of stages) {
    const filePath = ciDepsPath(root, stage);
    if (!fs.existsSync(filePath)) {
      fail(`missing ${stage === "dev" ? "ci-deps.dev.json" : "ci-deps.prod.json"}`);
    }
    const data = readJson(filePath);
    if (!data?.renderer) {
      fail(`${stage === "dev" ? "ci-deps.dev.json" : "ci-deps.prod.json"} must include renderer`);
    }
    manifests[stage] = data;
  }

  const pkgJson = readJson(packageJsonPath(root));
  if (!pkgJson) {
    fail(`missing ${packageJsonPath(root)}`);
  }

  let profileInfo;
  try {
    profileInfo = detectProfile(pkgJson, {});
  } catch (err) {
    fail(err.message);
  }

  for (const pkg of profileInfo.packages) {
    const key = MANIFEST_KEYS[pkg];
    if (!(pkg in (pkgJson.dependencies ?? {}))) {
      continue;
    }
    for (const stage of stages) {
      if (!manifests[stage][key]) {
        fail(`ci-deps.${stage}.json must include ${key} for this consumer`);
      }
    }
  }

  if (
    manifests.prod.gameslib &&
    manifests.dev.gameslib &&
    manifests.prod.gameslib === manifests.dev.gameslib
  ) {
    warn("prod and dev pin the same gameslib version");
  }

  if (manifests.prod.renderer === manifests.dev.renderer) {
    warn("prod and dev pin the same renderer version");
  }

  if (checkStage) {
    checkLockfileDrift(root, checkStage, manifests[checkStage], profileInfo, strict);
  }

  console.log("check-ci-deps OK");
}

function checkLockfileDrift(root, stage, manifest, profileInfo, strict) {
  const fix = `run: npm run sync-deps${stage === "prod" ? ":prod" : ""} (or npx ap-install-deps --stage ${stage})`;
  const lockVersions = getLockfileVersions(root, profileInfo.packages);

  for (const pkg of profileInfo.packages) {
    const key = MANIFEST_KEYS[pkg];
    const expected = manifest[key];
    if (!expected) {
      continue;
    }
    const lockVersion = lockVersions[pkg];
    if (lockVersion !== expected) {
      const msg =
        `lockfile ${pkg} (${lockVersion ?? "missing"}) differs from ` +
        `ci-deps.${stage}.json (${expected}); ${fix}`;
      if (strict) {
        fail(msg);
      }
      warn(msg);
    }
  }

  const overrideRenderer = readJson(packageJsonPath(root))?.overrides?.[AP_PACKAGES.renderer];
  if (
    manifest.renderer &&
    overrideRenderer &&
    overrideRenderer !== manifest.renderer &&
    overrideRenderer !== "0.0.0-managed"
  ) {
    const msg =
      `package.json overrides renderer (${overrideRenderer}) differs from ` +
      `ci-deps.${stage}.json (${manifest.renderer}); ${fix}`;
    if (strict) {
      fail(msg);
    }
    warn(msg);
  }
}
