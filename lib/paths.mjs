import path from "path";

export function ciDepsPath(root, stage) {
  return path.join(root, `ci-deps.${stage}.json`);
}

export function manifestLabel(stage) {
  return `ci-deps.${stage}.json`;
}

export function legacyCiDepsPath(root) {
  return path.join(root, "ci-deps.json");
}

export function packageJsonPath(root) {
  return path.join(root, "package.json");
}

export function lockfilePath(root) {
  return path.join(root, "package-lock.json");
}
