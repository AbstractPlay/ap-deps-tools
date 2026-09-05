import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import { describe, it } from "node:test";
import { getLockfileVersions } from "../lib/lockfile-versions.mjs";
import { detectProfile } from "../lib/profile.mjs";
import { resolveVersions } from "../lib/resolve-versions.mjs";
import { readJson } from "../lib/fs-utils.mjs";
import { syncPackageJson } from "../lib/install-core.mjs";
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
        "@abstractplay/gameslib": "1.0.0-ci-1.0",
        "@abstractplay/recranks": "1.0.0-ci-2.0",
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

describe("syncPackageJson", () => {
  it("writes exact ci-deps versions into package.json dependencies", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "ap-deps-sync-"));
    const pkgPath = path.join(root, "package.json");
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({
        dependencies: {
          "@abstractplay/gameslib": "1.0.0-ci-old.0",
          "@abstractplay/renderer": "1.0.0-ci-old.0",
        },
      }),
    );
    const pkgJson = readJson(pkgPath);
    syncPackageJson(root, pkgJson, {
      packages: ["@abstractplay/gameslib", "@abstractplay/renderer"],
      gameslib: "1.0.0-ci-100.0",
      renderer: "1.0.0-ci-99.0",
      profile: "consumer",
    });
    const written = readJson(pkgPath);
    assert.equal(written.dependencies["@abstractplay/gameslib"], "1.0.0-ci-100.0");
    assert.equal(written.dependencies["@abstractplay/renderer"], "1.0.0-ci-99.0");
  });
});
