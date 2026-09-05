import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { AP_PACKAGES } from "./constants.mjs";
import { writeJson } from "./fs-utils.mjs";
import { packageJsonPath } from "./paths.mjs";
import { versionMatches } from "./resolve-versions.mjs";

/**
 * Write resolved AP versions into package.json (exact ci-deps / dispatch pins).
 *
 * @param {string} root
 * @param {object} pkgJson
 * @param {object} versions
 * @param {string[]} versions.packages
 * @param {string | null} versions.renderer
 * @param {boolean} versions.forTests
 */
export function syncPackageJson(root, pkgJson, versions) {
  pkgJson.dependencies = pkgJson.dependencies ?? {};

  for (const pkg of versions.packages) {
    if (!(pkg in pkgJson.dependencies)) {
      continue;
    }
    if (versions.forTests && pkg === AP_PACKAGES.gameslib) {
      continue;
    }
    let version = null;
    if (pkg === AP_PACKAGES.gameslib) {
      version = versions.gameslib;
    } else if (pkg === AP_PACKAGES.renderer) {
      version = versions.renderer;
    } else if (pkg === AP_PACKAGES.recranks) {
      version = versions.recranks;
    }
    if (version) {
      pkgJson.dependencies[pkg] = version;
    }
  }

  const hasDirectRenderer = AP_PACKAGES.renderer in (pkgJson.dependencies ?? {});
  const needsRendererOverride =
    versions.renderer &&
    hasDirectRenderer &&
    versions.packages.includes(AP_PACKAGES.gameslib);

  if (needsRendererOverride) {
    // npm 11 rejects overrides that target a direct dependency; lockfile pins suffice.
    if (pkgJson.overrides?.[AP_PACKAGES.renderer]) {
      delete pkgJson.overrides[AP_PACKAGES.renderer];
      if (Object.keys(pkgJson.overrides).length === 0) {
        delete pkgJson.overrides;
      }
    }
  } else if (
    versions.profile === "renderer-only" &&
    hasDirectRenderer &&
    versions.renderer
  ) {
    pkgJson.overrides = pkgJson.overrides ?? {};
    pkgJson.overrides[AP_PACKAGES.renderer] = versions.renderer;
  }

  writeJson(packageJsonPath(root), pkgJson);
}

/**
 * @param {string} root
 * @param {object} versions
 */
export function installPackages(root, versions) {
  const pkgs = [];
  if (versions.packages.includes(AP_PACKAGES.gameslib) && versions.gameslib) {
    pkgs.push(`${AP_PACKAGES.gameslib}@${versions.gameslib}`);
  }
  if (versions.packages.includes(AP_PACKAGES.renderer) && versions.renderer) {
    pkgs.push(`${AP_PACKAGES.renderer}@${versions.renderer}`);
  }
  if (versions.packages.includes(AP_PACKAGES.recranks) && versions.recranks) {
    pkgs.push(`${AP_PACKAGES.recranks}@${versions.recranks}`);
  }

  if (pkgs.length === 0) {
    throw new Error("No AP packages to install");
  }

  console.log(`Installing: ${pkgs.join(" ")}`);
  // Must update package-lock.json (syncPackageJson already wrote package.json).
  execSync(`npm install --save-exact ${pkgs.join(" ")}`, {
    cwd: root,
    stdio: "inherit",
  });
}

export function getInstalledVersion(root, pkg) {
  const pkgPath = path.join(root, "node_modules", ...pkg.split("/"), "package.json");
  if (fs.existsSync(pkgPath)) {
    return JSON.parse(fs.readFileSync(pkgPath, "utf8")).version;
  }

  try {
    const out = execSync(`npm ls ${pkg} --depth=0 --json`, {
      cwd: root,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(out).dependencies?.[pkg]?.version ?? null;
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout).dependencies?.[pkg]?.version ?? null;
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * @param {string} root
 * @param {object} versions
 */
export function verifyInstalledVersions(root, versions) {
  if (versions.packages.includes(AP_PACKAGES.renderer)) {
    const installedRenderer = getInstalledVersion(root, AP_PACKAGES.renderer);
    if (!versionMatches(installedRenderer, versions.renderer)) {
      throw new Error(
        `Renderer version mismatch: expected ${versions.renderer}, got ${installedRenderer}`,
      );
    }
    console.log(`${AP_PACKAGES.renderer}@${installedRenderer}`);
  }

  if (versions.packages.includes(AP_PACKAGES.gameslib) && versions.gameslib) {
    const installedGameslib = getInstalledVersion(root, AP_PACKAGES.gameslib);
    if (!versionMatches(installedGameslib, versions.gameslib)) {
      throw new Error(
        `Gameslib version mismatch: expected ${versions.gameslib}, got ${installedGameslib}`,
      );
    }
    console.log(`${AP_PACKAGES.gameslib}@${installedGameslib}`);
  }

  if (versions.packages.includes(AP_PACKAGES.recranks) && versions.recranks) {
    const installedRecranks = getInstalledVersion(root, AP_PACKAGES.recranks);
    if (!versionMatches(installedRecranks, versions.recranks)) {
      throw new Error(
        `Recranks version mismatch: expected ${versions.recranks}, got ${installedRecranks}`,
      );
    }
    console.log(`${AP_PACKAGES.recranks}@${installedRecranks}`);
  }
}

/**
 * @param {string} root
 * @param {object} versions
 * @param {boolean} verifyProdGameslib
 */
export function verifyGameslibProductionBuild(root, versions, verifyProdGameslib) {
  if (
    !verifyProdGameslib ||
    versions.stage !== "prod" ||
    versions.forTests ||
    !versions.packages.includes(AP_PACKAGES.gameslib)
  ) {
    return;
  }

  const gameslibRoot = path.join(root, "node_modules", "@abstractplay", "gameslib");
  const metaPath = path.join(
    gameslibRoot,
    "build",
    "games",
    "_registry-meta.generated.json",
  );
  const flagsPath = path.join(
    gameslibRoot,
    "build",
    "games",
    "_build-flags.generated.js",
  );
  const installed = getInstalledVersion(root, AP_PACKAGES.gameslib);

  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    if (meta.production !== true) {
      throw new Error(
        `Refusing prod install: @abstractplay/gameslib@${installed} ` +
          `has production=false in registry meta (${meta.gameCount} games, ` +
          `${(meta.experimentalUids ?? []).length} experimental). ` +
          `Pin a Production Server CI build in ci-deps.prod.json.`,
      );
    }
    console.log(
      `gameslib production registry verified (${meta.gameCount} games; experimental omitted)`,
    );
    return;
  }

  if (!fs.existsSync(flagsPath)) {
    throw new Error(
      `Production deploy could not verify @abstractplay/gameslib@${installed}: ` +
        `missing ${metaPath} and ${flagsPath}`,
    );
  }

  const flagsSource = fs.readFileSync(flagsPath, "utf8");
  if (!/APGAMES_PRODUCTION\s*=\s*true/.test(flagsSource)) {
    throw new Error(
      `Refusing prod install: @abstractplay/gameslib@${installed} ` +
        `does not set APGAMES_PRODUCTION=true in ${flagsPath}. ` +
        `Pin a Production Server CI build in ci-deps.prod.json.`,
    );
  }

  console.log("gameslib production build verified (APGAMES_PRODUCTION=true)");
}
