import { AP_PACKAGES } from "./constants.mjs";

/**
 * @typedef {"consumer" | "crons" | "hub" | "renderer-only"} ApDepsProfile
 */

/**
 * @param {object} pkgJson
 * @param {{ rendererOnly?: boolean }} flags
 * @returns {{ profile: ApDepsProfile, packages: string[], verifyProdGameslib: boolean }}
 */
export function detectProfile(pkgJson, flags = {}) {
  const deps = pkgJson.dependencies ?? {};

  if (flags.rendererOnly) {
    return {
      profile: "renderer-only",
      packages: [AP_PACKAGES.renderer],
      verifyProdGameslib: false,
    };
  }

  if (pkgJson.name === AP_PACKAGES.gameslib) {
    return {
      profile: "hub",
      packages: [AP_PACKAGES.renderer, AP_PACKAGES.recranks],
      verifyProdGameslib: false,
    };
  }

  if (pkgJson.name === "abstractplay-backend-crons") {
    return {
      profile: "crons",
      packages: [AP_PACKAGES.gameslib, AP_PACKAGES.renderer, AP_PACKAGES.recranks],
      verifyProdGameslib: true,
    };
  }

  if (AP_PACKAGES.gameslib in deps) {
    return {
      profile: "consumer",
      packages: [AP_PACKAGES.gameslib, AP_PACKAGES.renderer],
      verifyProdGameslib: true,
    };
  }

  if (AP_PACKAGES.renderer in deps) {
    return {
      profile: "renderer-only",
      packages: [AP_PACKAGES.renderer],
      verifyProdGameslib: false,
    };
  }

  throw new Error(
    "Could not detect AP deps profile: no @abstractplay/gameslib or @abstractplay/renderer in dependencies",
  );
}
