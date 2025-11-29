# Context Craft release playbook

Use this checklist to cut and publish a new version of the extension. It assumes you have push access to `origin` and are signed in to GitHub (`gh auth status`) and the VS Code Marketplace (`vsce` PAT configured in `~/.vsce`).

## 0) Prep
- Ensure the working tree is clean: `git status --short` should show nothing.
- Pull latest `master`: `git pull origin master`.

## 1) Version + changelog
- Pick the new semver (e.g., bump minor for new features). Use the calendar date for the changelog heading (YYYY-MM-DD).
- Update versions:
  - `package.json` → `"version"`
  - `package-lock.json` → both top-level `version` and `packages[""].version` (the root entry)
- Update docs:
  - `README.md` version badge text
  - `CHANGELOG.md` add a new section under `[Unreleased]` with the date and bullet points.

## 2) Lint, build, and test
- Run full suite (fails fast if anything breaks):
  ```bash
  npm test
  ```
  If you need to rerun integration only (e.g., after a timeout):
  ```bash
  npm run test:integration:run
  ```

## 3) Commit
- Commit the release metadata updates:
  ```bash
  git commit -am "chore(release): X.Y.Z"
  ```

## 4) Tag + push
- Create an annotated tag and push code + tags:
  ```bash
  git tag -a vX.Y.Z -m "Release X.Y.Z"
  git push origin master --follow-tags
  ```

## 5) Package
- Build the VSIX (runs `npm run vscode:prepublish` first):
  ```bash
  npx @vscode/vsce package
  ```
- Result: `context-craft-X.Y.Z.vsix` in repo root.

## 6) GitHub release
- Prepare notes (highlights + checks). Example template:
  ```
  ## Highlights
  - ...

  ## Checks
  - npm run lint
  - npm run build:tests
  - npm run test:unit:run
  - npm run test:integration:run
  ```
- Publish with asset:
  ```bash
  gh release create vX.Y.Z context-craft-X.Y.Z.vsix \
    -t "Context Craft X.Y.Z" \
    -F /path/to/notes.md
  ```

## Troubleshooting
- If `npm test` times out during integration download, rerun `npm run test:integration:run` (uses cached VS Code after first download).
- If packaging warns about many files, consider adding to `.vscodeignore` or bundling; the warning is informational only.
