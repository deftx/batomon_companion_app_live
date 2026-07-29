# Release workflow (private — do not publish this file publicly if you'd rather keep it internal)

Two repos, one local checkout:

| Remote | Repo | Visibility | Purpose |
|---|---|---|---|
| `wip` | `deftx/bca_wip` | **private** | where you work. Push freely, anything goes. |
| `live` | `deftx/batomon_companion_app_live` | **public** | what players download. Only ever receives finished releases. |

Branch: `main` on both.

---

## Day-to-day (working)

```bash
git add -A
git commit -m "what changed"
git push wip main
```

Run locally with **`dev.cmd`** (auto-refresh ON) instead of `start.cmd`, so your dataset self-heals while you develop.

---

## Shipping a release ("merge")

When you say *merge*, this is what happens:

1. **Bump the version** in BOTH places (they must match):
   - `app.js` → `const APP_VERSION = 'X.Y.Z'`
   - `version.json` → `"version": "X.Y.Z"`, and update `"notes"`.
2. **Decide if it's a forced update.**
   - Normal release → leave `minSupported` alone. Old installs get a **dismissible banner**.
   - Breaking release → set `"minSupported": "X.Y.Z"` (the new version). Every older install is **hard-blocked** with a full-screen "update required" screen and a download button. *This is the kill-switch.*
3. **Verify** — `node -c app.js`, run the suites, click through the app.
4. **Publish:**

```bash
git add -A
git commit -m "release vX.Y.Z"
git tag vX.Y.Z
git push wip main --tags
git push live main --tags
```

Because `version.json` is served from the **public** repo's `main`, every install on the planet sees the new manifest within one session and reacts per step 2.

---

## How the update check works

- On boot (2.5s after paint) the app fetches `version.json` from the public repo via raw.githubusercontent.com.
- `APP_VERSION < minSupported` → full-screen block, app unusable, download CTA.
- `manifest.version > APP_VERSION` → dismissible bottom banner ("Get it").
- No network / malformed manifest → **fails open**, the app runs normally. Offline players are never locked out by accident.

Only an explicit, well-formed `minSupported` can retire a build.

---

## First-time remote setup

```bash
git remote add wip  https://github.com/deftx/bca_wip.git
git remote add live https://github.com/deftx/batomon_companion_app_live.git
git push -u wip main
git push    live main
```

---

## What ships

Everything except `art/` (the upscaled sprite workspace for artwork — gitignored), temp files, and local scratch. The pinned dataset (`dataset.json`, `data.js`, `synergy*.json`, `discovered-builds.json`, `master-bench.json`) IS shipped on purpose: every player runs identical, tested numbers until the next release.
