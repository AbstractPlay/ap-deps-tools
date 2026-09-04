import { AP_PACKAGES } from "./constants.mjs";
import { readJson } from "./fs-utils.mjs";
import { ciDepsPath, legacyCiDepsPath, manifestLabel } from "./paths.mjs";

function readManifest(root, stage) {
  const staged = readJson(ciDepsPath(root, stage));
  if (staged) {
    return staged;
  }
  const legacy = readJson(legacyCiDepsPath(root));
  if (legacy) {
    console.warn(
      `Warning: using legacy ci-deps.json; migrate to ${manifestLabel(stage)}`,
    );
    return legacy;
  }
  return null;
}

/**
 * @param {object} params
 * @param {string} params.root
 * @param {"dev"|"prod"} params.stage
 * @param {import("./profile.mjs").detectProfile extends (...args: any) => infer R ? R : never} params.profileInfo
 * @param {object} params.pkgJson
 * @param {boolean} [params.forTests]
 */
export function resolveVersions({ root, stage, profileInfo, pkgJson, forTests = false }) {
  const dispatchGameslib = process.env.AP_GAMESLIB_VERSION?.trim() || null;
  const dispatchRenderer = process.env.AP_RENDERER_VERSION?.trim() || null;
  const dispatchRecranks = process.env.AP_RECRANKS_VERSION?.trim() || null;
  const manifest = readManifest(root, stage);
  const manifestName = manifestLabel(stage);
  const { profile, packages } = profileInfo;

  /** @type {Record<string, string | null>} */
  const resolved = {
    renderer: dispatchRenderer || manifest?.renderer || null,
    gameslib: null,
    recranks: null,
  };

  if (packages.includes(AP_PACKAGES.gameslib)) {
    resolved.gameslib = dispatchGameslib || manifest?.gameslib || null;
  }

  if (packages.includes(AP_PACKAGES.recranks)) {
    resolved.recranks = dispatchRecranks || manifest?.recranks || null;
  }

  let source = manifestName;

  if (forTests) {
    const testOverride = process.env.AP_GAMESLIB_TEST_VERSION?.trim();
    if (testOverride && packages.includes(AP_PACKAGES.gameslib)) {
      resolved.gameslib = testOverride;
      source = "for-tests@AP_GAMESLIB_TEST_VERSION";
    } else {
      source = `${manifestName} (for-tests)`;
    }
  } else if (dispatchGameslib || dispatchRenderer || dispatchRecranks) {
    source = process.env.AP_SOURCE || "repository_dispatch";
  }

  const tag = stage === "prod" ? "latest" : "development";

  if (packages.includes(AP_PACKAGES.renderer) && !resolved.renderer) {
    console.warn(`No renderer version resolved; falling back to @${tag}`);
    resolved.renderer = tag;
    source = source === manifestName ? `fallback@${tag}` : source;
  }

  if (packages.includes(AP_PACKAGES.gameslib) && !resolved.gameslib) {
    console.warn(`No gameslib version resolved; falling back to @${tag}`);
    resolved.gameslib = tag;
    if (source === manifestName) {
      source = `fallback@${tag}`;
    }
  }

  if (packages.includes(AP_PACKAGES.recranks) && !resolved.recranks) {
    // Hub: step 3 — package.json before tag fallback
    resolved.recranks =
      pkgJson.dependencies?.[AP_PACKAGES.recranks] || null;
    if (!resolved.recranks || resolved.recranks === "0.0.0-managed") {
      if (profile === "hub" && pkgJson.dependencies?.[AP_PACKAGES.recranks]) {
        const fromPkg = pkgJson.dependencies[AP_PACKAGES.recranks];
        if (fromPkg !== "0.0.0-managed") {
          resolved.recranks = fromPkg;
        }
      }
    }
    if (!resolved.recranks) {
      console.warn(`No recranks version resolved; falling back to @${tag}`);
      resolved.recranks = tag;
      if (source === manifestName) {
        source = `fallback@${tag}`;
      }
    }
  }

  return {
    stage,
    profile,
    packages,
    gameslib: resolved.gameslib,
    renderer: resolved.renderer,
    recranks: resolved.recranks,
    source,
    forTests,
  };
}

export function versionMatches(installed, expected) {
  if (!installed) {
    return false;
  }
  if (expected === "development" || expected === "latest") {
    return true;
  }
  return installed === expected;
}
