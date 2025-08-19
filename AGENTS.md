# Repository Guidelines

## Project Structure & Module Organization
- Source: `src/` (entry: `src/extension.ts`). Commands in `src/commands/`; core modules include `FileTreeProvider.ts`, `selectionLogic.ts`, `tokenCounter.ts`, `getIgnoreParser.ts`, and `utils.ts`.
- Tests: `src/test/` (Mocha-style). Additional suites in `src/test/suite/`. Compiled tests run from `out/test/**/*.test.js` (see `.vscode-test.mjs`).
- Build output: `out/` (compiled JS and sourcemaps).
- Assets: `resources/` (icons, activity bar assets).
- Config: `tsconfig.json`, `eslint.config.mjs`, `.vscode-test.mjs`.

## Build, Test, and Development Commands
- `npm run watch`: Incremental TypeScript build during development.
- `npm run compile`: One-shot build to `out/`.
- `npm run lint`: ESLint over `src/`.
- `npm test`: Builds, lints, then runs VS Code tests via `@vscode/test-cli`.
- Run the extension: Open in VS Code and press `F5` (Extension Development Host).

## Coding Style & Naming Conventions
- Language: TypeScript (`strict` mode, `target` ES2022, `module` Node16).
- Indentation: Follow existing files (tabs are preferred in this repo).
- Naming: camelCase for functions/variables (`selectionLogic.ts`), PascalCase for classes/types (`FileTreeProvider.ts`).
- Imports: ESLint enforces camelCase/PascalCase for import identifiers.
- Linting: Key rules enabled — `curly`, `eqeqeq`, `semi`, and TypeScript naming convention for imports. Fix or justify warnings before PR.

## Testing Guidelines
- Framework: Mocha-style suites/tests executed by `@vscode/test-cli`.
- Location/Pattern: `src/test/**/*.test.ts` and `src/test/suite/**/*.test.ts` (compiled to `out/test/**`).
- Utilities: `sinon` available for fakes/timers; prefer deterministic, unit-focused tests near the corresponding module.
- Run: `npm test`. Add tests for new behavior and regressions; no coverage threshold enforced, but aim to exercise core paths.

## Commit & Pull Request Guidelines
- Commits: Imperative mood, concise subject, include rationale in body. Conventional Commits (e.g., `feat:`, `fix:`, `chore:`) are welcome; include issue refs like `(#12)` when relevant.
- PRs: Clear description, linked issues, steps to validate, and screenshots/GIFs when UI changes affect the tree view or status bar. Include test updates and README changes for user-visible behavior.

## Security & Configuration Tips
- The extension does not support Untrusted Workspaces; open a trusted folder. Avoid logging sensitive file contents. Test changes in single- and multi-root workspaces.

