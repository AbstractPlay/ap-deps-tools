import fs from "fs";
import path from "path";
import { readJson } from "./fs-utils.mjs";
import {
  bootstrapNpmCi,
  hasManagedPlaceholders,
  installPackages,
  syncPackageJson,
  verifyGameslibProductionBuild,
  verifyInstalledVersions,
} from "./install-core.mjs";
import { packageJsonPath } from "./paths.mjs";
import { detectProfile } from "./profile.mjs";
import { parseInstallArgs } from "./parse-args.mjs";
import { resolveVersions } from "./resolve-versions.mjs";
import { writeCiDeps, writeGithubOutput } from "./write-manifest.mjs";

/**
 * @param {string} [root]
 * @param {string[]} [argv]
 */
export function runInstall(root = process.cwd(), argv = process.argv) {
  const args = parseInstallArgs(argv);
  const pkgJson = readJson(packageJsonPath(root));
  if (!pkgJson) {
    throw new Error(`Missing ${packageJsonPath(root)}`);
  }

  const profileInfo = detectProfile(pkgJson, {
    rendererOnly: args.rendererOnly,
  });
  const versions = resolveVersions({
    root,
    stage: args.stage,
    profileInfo,
    pkgJson,
    forTests: args.forTests,
  });

  console.log("Resolved AP dependency versions:", versions);

  const nodeModulesPath = path.join(root, "node_modules");
  const shouldBootstrap =
    args.bootstrap ||
    (!fs.existsSync(nodeModulesPath) && hasManagedPlaceholders(pkgJson, versions.packages));

  if (shouldBootstrap) {
    bootstrapNpmCi(root, versions);
  }

  syncPackageJson(root, readJson(packageJsonPath(root)), versions);
  installPackages(root, versions);
  verifyInstalledVersions(root, versions);
  verifyGameslibProductionBuild(root, versions, profileInfo.verifyProdGameslib);
  writeCiDeps(root, versions);
  writeGithubOutput(versions);

  console.log("AP dependencies installed and verified.");
}
