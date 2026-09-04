import fs from "fs";
import { AP_PACKAGES } from "./constants.mjs";
import { readJson, writeJson } from "./fs-utils.mjs";
import { ciDepsPath } from "./paths.mjs";

/**
 * @param {string} root
 * @param {object} versions
 */
export function writeCiDeps(root, versions) {
  const outPath = ciDepsPath(root, versions.stage);

  if (versions.forTests) {
    const existing = readJson(outPath);
    if (!existing) {
      return;
    }
    const data = { ...existing };
    if (versions.renderer) {
      data.renderer = versions.renderer;
      data.updatedAt = new Date().toISOString();
    }
    writeJson(outPath, data);
    return;
  }

  const data = {
    renderer: versions.renderer,
    updatedAt: new Date().toISOString(),
    source: versions.source,
  };

  if (versions.packages.includes(AP_PACKAGES.gameslib) && versions.gameslib) {
    data.gameslib = versions.gameslib;
  }
  if (versions.packages.includes(AP_PACKAGES.recranks) && versions.recranks) {
    data.recranks = versions.recranks;
  }

  writeJson(outPath, data);
}

/**
 * @param {object} versions
 */
export function writeGithubOutput(versions) {
  const outFile = process.env.GITHUB_OUTPUT;
  if (!outFile) {
    return;
  }
  if (versions.renderer) {
    fs.appendFileSync(outFile, `renderer_version=${versions.renderer}\n`);
  }
  if (versions.gameslib) {
    fs.appendFileSync(outFile, `gameslib_version=${versions.gameslib}\n`);
  }
  if (versions.recranks) {
    fs.appendFileSync(outFile, `recranks_version=${versions.recranks}\n`);
  }
}
