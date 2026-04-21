# Release preflight for bbdata

Run this before `npm version` to catch the release-discipline gotchas documented in `CLAUDE.md`.

Execute each step and report pass/fail. **STOP on the first failure** unless the user explicitly approves continuing.

## 1. npm auth is fresh

```bash
npm whoami
```

If `E401` or empty, tell the user to `npm login` before proceeding. CLAUDE.md: discovering stale 2FA *after* `npm version` has already bumped means the commit is live but unpublished — painful to recover.

## 2. Working tree is clean

```bash
git status --short
```

Fail if anything is staged or modified. Untracked files are OK only if they're in `.gitignore` territory (e.g. `HANDOVER.md`). Don't proceed with dirty tracked files.

## 3. On `main` and up-to-date with origin

```bash
git rev-parse --abbrev-ref HEAD  # must be 'main'
git fetch origin main
git status -sb                    # must show "up to date with 'origin/main'"
```

## 4. Full publish gate passes locally

```bash
npm run build && npm run typecheck && npm run lint && npm test
```

This is `prepublishOnly` minus `npm publish`. Any failure stops the release. (CLAUDE.md: do not use `--ignore-scripts` to skip this.)

## 5. Unreleased section has content

Grep `TASKS.md` for `## Unreleased`. The bullet list below it must be non-empty. If empty, either there's nothing to release, or items need to be added before bumping.

## 6. TEST_PLAN.md has a section for the target version

Ask the user what bump type (`patch` / `minor` / `major`) and compute the target version from `package.json`. The target version should already have a `TEST_PLAN.md` section with smoke-test rows for any new feature/flag this release (CLAUDE.md: "Every release also updates `TEST_PLAN.md`").

If the section is missing, STOP and ask the user to add it before bumping.

## 7. Dependency section moves since last tag

```bash
git diff $(git describe --tags --abbrev=0) -- package.json | grep -E '"(dependencies|devDependencies)":' || echo "(no section changes)"
```

If any dep moved between `dependencies` and `devDependencies`, remind the user to run `npm install` *before* `npm version` so the lockfile re-sorts the `dev: true` flags. CLAUDE.md: `npm version` only touches the version field, so a stale lockfile will ship with the wrong section and fail consumer installs that filter by prod deps.

## 8. TASKS.md reconciliation preview

Show the user the current `## Unreleased` block and remind them it should be renamed to `## Shipped in vX.Y.Z` before or during the release commit. CLAUDE.md: "v0.7.0 and v0.7.1 both shipped without crossing off the nine items they completed" — this step has been skipped before.

## 9. Partial-wiring lint (if script exists)

```bash
[ -f scripts/check-partials.ts ] && npx tsx scripts/check-partials.ts
```

Catches the orphan-partial class of bug (footer.hbs v0.9.0 regression).

---

## Verdict

Print one of:

- `[OK] RELEASE READY — proceed with: npm version <type>`
- `[FAIL] RELEASE BLOCKED — <reason>`

If ready, echo the release sequence for the user to copy:

```bash
npm version <patch|minor|major>
git push --follow-tags origin main
npm publish
npm view bbdata@<new-version> version  # verify landed
```

Do NOT execute `npm version` or `npm publish` yourself. The user runs these so they control 2FA timing and can abort between bump and publish.
