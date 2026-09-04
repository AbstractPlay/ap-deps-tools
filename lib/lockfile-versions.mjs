import { AP_PACKAGES, MANIFEST_KEYS } from "./constants.mjs";
import { readJson } from "./fs-utils.mjs";
import { lockfilePath } from "./paths.mjs";

/**
 * Read resolved top-level @abstractplay/* versions from package-lock.json.
 *
 * @param {string} root
 * @param {string[]} [packages] - npm package names; defaults to all AP packages
 * @returns {Record<string, string | null>}
 */
export function getLockfileVersions(root, packages = Object.values(AP_PACKAGES)) {
  const lock = readJson(lockfilePath(root));
  if (!lock) {
    return Object.fromEntries(packages.map((pkg) => [pkg, null]));
  }

  const out = {};
  for (const pkg of packages) {
    out[pkg] = readVersionFromLock(lock, pkg);
  }
  return out;
}

function readVersionFromLock(lock, pkg) {
  const lockPackages = lock.packages ?? {};
  const directKey = `node_modules/${pkg}`;
  if (lockPackages[directKey]?.version) {
    return lockPackages[directKey].version;
  }

  // npm lockfile v2 also lists under node_modules/@scope/name
  for (const [key, entry] of Object.entries(lockPackages)) {
    if (key.endsWith(`/${pkg.split("/").pop()}`) && key.includes("@abstractplay")) {
      if (entry.name === pkg || key === directKey) {
        return entry.version ?? null;
      }
    }
  }

  if (lock.dependencies?.[pkg]?.version) {
    return lock.dependencies[pkg].version;
  }

  return lockPackages[directKey]?.version ?? null;
}

/**
 * Map lockfile versions to ci-deps manifest keys (gameslib, renderer, recranks).
 *
 * @param {string} root
 * @param {string[]} packages
 */
export function getResolvedApVersions(root, packages = Object.values(AP_PACKAGES)) {
  const lockVersions = getLockfileVersions(root, packages);
  /** @type {Record<string, string | null>} */
  const manifest = {};
  for (const [pkg, version] of Object.entries(lockVersions)) {
    const key = MANIFEST_KEYS[pkg];
    if (key) {
      manifest[key] = version;
    }
  }
  return manifest;
}
