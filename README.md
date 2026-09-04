# @abstractplay/ap-deps-tools

CLI utilities for installing and validating pinned `@abstractplay/*` package versions in Abstract Play consumer repositories.

Replaces per-repo copies of `install-ap-deps.mjs` and `check-ci-deps.mjs`. Works with the existing **ci-deps relay**:

- Canonical pins: `ci-deps.dev.json` and `ci-deps.prod.json`
- Resolved tree: `package-lock.json`
- `package.json` AP dependency fields use stable placeholders (`0.0.0-managed`)

## Install

```bash
npm install --save-dev @abstractplay/ap-deps-tools
```

Requires GitHub Packages auth for `@abstractplay` scope (same as other AP packages).

## Commands

### `ap-install-deps`

```bash
ap-install-deps --stage dev|prod [--renderer-only] [--for-tests]
```

Resolution order (per package):

1. `AP_GAMESLIB_VERSION` / `AP_RENDERER_VERSION` / `AP_RECRANKS_VERSION` env (from `repository_dispatch`)
2. `ci-deps.<stage>.json`
3. `@development` (dev) or `@latest` (prod) fallback

Updates the lockfile via `npm install --no-save --save-exact`, writes `ci-deps.<stage>.json`, and sets `GITHUB_OUTPUT` when running in GitHub Actions.

### `ap-check-ci-deps`

```bash
ap-check-ci-deps
ap-check-ci-deps --stage dev --strict
```

Validates both ci-deps manifests exist. With `--strict`, compares **lockfile** resolved versions to the stage manifest (not `package.json` dependency strings).

## npm scripts (consumer repos)

```json
{
  "scripts": {
    "sync-deps": "ap-install-deps --stage dev",
    "sync-deps:prod": "ap-install-deps --stage prod"
  }
}
```

## Consumer profiles

Auto-detected from `package.json`:

| Profile | Repo examples | Packages pinned |
|---------|---------------|-----------------|
| `consumer` | front, node-backend | gameslib, renderer |
| `crons` | backend-crons | gameslib, renderer, recranks |
| `hub` | gameslib | renderer, recranks |
| `renderer-only` | designer | renderer |

Recranks is **not** pinned for front/node-backend (transitive via gameslib).

## CI sequence

```text
npm ci
ap-check-ci-deps
ap-install-deps --stage dev|prod
ap-check-ci-deps --stage dev|prod --strict
npm test / build / deploy
```

## Programmatic API

```javascript
import { getResolvedApVersions, getLockfileVersions } from "@abstractplay/ap-deps-tools";

const versions = getResolvedApVersions(process.cwd(), [
  "@abstractplay/gameslib",
  "@abstractplay/renderer",
]);
```

## Where to find the real pin

| Source | Purpose |
|--------|---------|
| `ci-deps.dev.json` / `ci-deps.prod.json` | Canonical pin per stage |
| `package-lock.json` | Exact resolved versions for `npm ci` |
| `npm ls @abstractplay/gameslib` | Local inspection after `sync-deps` |

## License

MIT — see [LICENSE](LICENSE).
