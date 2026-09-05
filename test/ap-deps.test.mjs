import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getLockfileVersions } from "../lib/lockfile-versions.mjs";
import { detectProfile } from "../lib/profile.mjs";
import { resolveVersions } from "../lib/resolve-versions.mjs";
import { readJson } from "../lib/fs-utils.mjs";
import { applyRealVersions, hasManagedPlaceholders } from "../lib/install-core.mjs";
import { PLACEHOLDER_VERSION } from "../lib/constants.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURES = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");

describe("lockfile-versions", () => {
  it("reads top-level @abstractplay versions from lockfile v3", () => {
    const root = path.join(FIXTURES, "consumer");
    const versions = getLockfileVersions(root, [
      "@abstractplay/gameslib",
      "@abstractplay/renderer",
    ]);
    assert.equal(versions["@abstractplay/gameslib"], "1.0.0-ci-100.0");
    assert.equal(versions["@abstractplay/renderer"], "1.0.0-ci-99.0");
  });
});

describe("profile", () => {
  it("detects consumer profile for front-like package.json", () => {
    const pkgJson = readJson(path.join(FIXTURES, "consumer", "package.json"));
    const info = detectProfile(pkgJson);
    assert.equal(info.profile, "consumer");
    assert.deepEqual(info.packages, [
      "@abstractplay/gameslib",
      "@abstractplay/renderer",
    ]);
  });

  it("detects hub profile for gameslib", () => {
    const pkgJson = { name: "@abstractplay/gameslib", dependencies: {} };
    const info = detectProfile(pkgJson);
    assert.equal(info.profile, "hub");
  });

  it("detects crons by package name", () => {
    const pkgJson = {
      name: "abstractplay-backend-crons",
      dependencies: {
        "@abstractplay/gameslib": "0.0.0-managed",
        "@abstractplay/recranks": "0.0.0-managed",
      },
    };
    const info = detectProfile(pkgJson);
    assert.equal(info.profile, "crons");
  });
});

describe("resolveVersions", () => {
  it("prefers ci-deps manifest over fallback", () => {
    const root = path.join(FIXTURES, "consumer");
    const pkgJson = readJson(path.join(root, "package.json"));
    const profileInfo = detectProfile(pkgJson);
    const versions = resolveVersions({
      root,
      stage: "dev",
      profileInfo,
      pkgJson,
    });
    assert.equal(versions.gameslib, "1.0.0-ci-100.0");
    assert.equal(versions.renderer, "1.0.0-ci-99.0");
  });

  it("uses dispatch env over ci-deps", () => {
    const root = path.join(FIXTURES, "consumer");
    const pkgJson = readJson(path.join(root, "package.json"));
    const profileInfo = detectProfile(pkgJson);
    const prev = process.env.AP_GAMESLIB_VERSION;
    process.env.AP_GAMESLIB_VERSION = "1.0.0-ci-999.0";
    try {
      const versions = resolveVersions({
        root,
        stage: "dev",
        profileInfo,
        pkgJson,
      });
      assert.equal(versions.gameslib, "1.0.0-ci-999.0");
    } finally {
      if (prev === undefined) {
        delete process.env.AP_GAMESLIB_VERSION;
      } else {
        process.env.AP_GAMESLIB_VERSION = prev;
      }
    }
  });
});

describe("placeholders", () => {
  it("detects managed placeholders in package.json", () => {
    const pkgJson = {
      dependencies: {
        "@abstractplay/gameslib": PLACEHOLDER_VERSION,
        "@abstractplay/renderer": PLACEHOLDER_VERSION,
      },
    };
    assert.equal(
      hasManagedPlaceholders(pkgJson, [
        "@abstractplay/gameslib",
        "@abstractplay/renderer",
      ]),
      true,
    );
  });

  it("writes ci-deps versions for bootstrap npm ci", () => {
    const pkgJson = {
      dependencies: {
        "@abstractplay/gameslib": PLACEHOLDER_VERSION,
        "@abstractplay/renderer": PLACEHOLDER_VERSION,
      },
    };
    applyRealVersions(pkgJson, {
      packages: ["@abstractplay/gameslib", "@abstractplay/renderer"],
      gameslib: "1.0.0-ci-100.0",
      renderer: "1.0.0-ci-99.0",
    });
    assert.equal(pkgJson.dependencies["@abstractplay/gameslib"], "1.0.0-ci-100.0");
    assert.equal(pkgJson.dependencies["@abstractplay/renderer"], "1.0.0-ci-99.0");
  });
});
