# Context Craft

![VS Code](https://img.shields.io/badge/VS%20Code-%5E1.96.2-blue?logo=visualstudiocode&logoColor=white)
![Version](https://img.shields.io/badge/version-1.3.4-6b5b95)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)

Curate exactly the files you want to share with an LLM. Context Craft adds a dedicated tree view to VS Code so you can cherry-pick files, count their approximate tokens, and copy the selection as an XML payload that pastes cleanly into any prompt window.

## Table of contents

1. [Highlights](#highlights)
2. [Quick start](#quick-start)
3. [Working with the Context Craft view](#working-with-the-context-craft-view)
4. [Commands](#commands)
5. [Status & safety feedback](#status--safety-feedback)
6. [Selection rules & XML payload](#selection-rules--xml-payload)
7. [Requirements & compatibility](#requirements--compatibility)
8. [Installation](#installation)
9. [Development workflow](#development-workflow)
10. [Testing](#testing)
11. [Project layout](#project-layout)
12. [Release checklist](#release-checklist)
13. [Troubleshooting](#troubleshooting)
14. [Contributing](#contributing)
15. [License](#license)

## Highlights

- **Multi-root ready** – each workspace folder renders as its own root with shared commands, and selections persist per workspace via VS Code workspace state.
- **Git-aware selection** – one click selects every uncommitted change detected by the built-in Git extension, skipping deleted or out-of-scope files automatically.
- **LLM-friendly payloads** – copies selected files into a `<code_files>` XML document, grouping multi-root workspaces into `<workspace>` tags and wrapping contents in `CDATA` blocks.
- **Token estimates at a glance** – a status bar item and tree header show `N files | M tokens`, powered by the `cl100k_base` tokenizer used by GPT-4o/GPT-4 Turbo.
- **Ignore + safety rails** – respects `.gitignore`, skips binaries, truncates files over 200 KB, and caps traversal at 10,000 files to prevent runaway memory usage.
- **Contextual file actions** – open, rename, delete, copy path, or reveal in Finder/Explorer without leaving the curated tree.

## Quick start

1. Install the extension (see [Installation](#installation)).
2. Open a trusted workspace folder (the extension is disabled for VS Code's untrusted-workspace mode).
3. In the Activity Bar, choose **Context Craft** to reveal the file browser with checkboxes.
4. Check folders or files to include them. Parent selections automatically cover all children and stay in sync even as the tree refreshes.
5. Use **Copy Selected** from the tree title, the Command Palette, or the command menu to push the XML payload to your clipboard.
6. Paste directly into your LLM/chat window; the status bar readout confirms how many files/tokens you just copied.

## Working with the Context Craft view

- The view lives inside its own activity bar container (`contextCraftExplorer`) so it never displaces Source Control or Explorer.
- File system updates stream through a `FileSystemWatcher`, so creating/renaming/deleting files refreshes the tree automatically without jitter.
- Checkbox state is cached, and each refresh reconciles selections so that redundant nested entries are collapsed into the shallowest possible node.
- Selecting a root workspace folder in a multi-root setup selects only that folder's subtree; other roots keep their own independent state.
- The title bar includes quick actions for **Select Git Changes**, **Unselect All**, **Copy Selected**, and **Refresh**.

## Commands

### View title commands

| Command | Description |
| --- | --- |
| `Context Craft: Select Git Changes` (`contextCraft.selectGitChanges`) | Pulls every staged/unstaged/merge change from all Git repositories in the workspace and replaces the current selection with those files.
| `Context Craft: Unselect All` (`contextCraft.unselectAll`) | Clears every checkbox and persisted selection entry.
| `Context Craft: Copy Selected` (`contextCraft.copySelected`) | Resolves the current selection (respecting `.gitignore`, binary checks, and caps) and copies it to the clipboard as XML, including the token count notification.
| `Context Craft: Refresh` (`contextCraft.refresh`) | Forces the tree to re-query the file system; handy after large refactors or when ignoring files.

### Item context menu commands

| Context menu entry | Command ID | What it does |
| --- | --- | --- |
| Open | `contextCraft.openFile` | Opens the file in the current editor column.
| Open to the Side | `contextCraft.openToSide` | Opens the file in a new column to preserve context.
| Reveal in File Explorer | `contextCraft.revealInOS` | Shows the file/folder in Finder/Explorer.
| Open in Integrated Terminal (folders) | `contextCraft.openInTerminal` | Launches a terminal scoped to the folder.
| Copy Path / Copy Relative Path | `contextCraft.copyPath` / `contextCraft.copyRelativePath` | Copies absolute or workspace-relative paths.
| Rename | `contextCraft.renameFile` | Renames files/folders while protecting workspace roots.
| Delete | `contextCraft.deleteFile` | Deletes the file/folder (VS Code shows the usual confirmation prompt).

## Status & safety feedback

- **Status bar item** – displays `f files | t tokens`. When work is in progress you will see `$(sync~spin) Calculating…` with a hint about how many items are selected.
- **Tree header message** – mirrors the status bar so the information is visible even when the status bar is hidden.
- **Workspace guardrails** – if no workspace folders are open, the status bar reads `No workspace` and commands that require files become no-ops with a warning toast.
- **Cancellation + debouncing** – long-running refreshes are cancellable via `AbortController` to keep the UI responsive. Workspace folder changes prune stale selections before re-running.

## Selection rules & XML payload

- Parent selections subsume child selections; deselecting a child from an already-selected parent re-selects the remaining siblings so the final payload stays accurate.
- Selections persist in `context.workspaceState` (`contextCraft.selectedPaths`) per workspace, so your curated context survives reloads.
- File traversal respects `.gitignore` entries per workspace and skips commonly ignored folders (e.g., `.git`, `node_modules`, `out`, `dist`).
- Binary files are detected by scanning the first 512 bytes; binaries and anything larger than **200 KB (`MAX_PREVIEW_BYTES`)** are replaced with self-describing placeholder tags.
- Traversal stops once **10,000 files (`MAX_COLLECTED_FILES`)** have been gathered to avoid exhausting memory. The tree logs a warning and shows the cap in the notification if it triggers.
- XML structure example:

```xml
<code_files>
  <file name="src/index.ts" path="src/index.ts"><![CDATA[
  // file contents
  ]]></file>
  <file name="large.bin" path="assets/large.bin" binary="true" />
  <file name="big.log" path="logs/big.log" truncated="true" />
</code_files>
```

For multi-root workspaces, each folder is wrapped in a `<workspace name="MyRepo" path="/abs/path">…</workspace>` block.

## Requirements & compatibility

- VS Code **1.96.2** or newer (per the `engines.vscode` field).
- Trusted workspace (untrusted workspaces are marked unsupported via the `capabilities.untrustedWorkspaces` flag).
- Git support relies on the built-in `vscode.git` extension being installed and enabled.
- Local copies only – nothing is uploaded; clipboard contents stay on your machine until you paste them elsewhere.

## Installation

### From the VS Code Marketplace

1. Open the Extensions view (`⇧⌘X` / `Ctrl+Shift+X`).
2. Search for **"Context Craft"** or run `ext install airizom.context-craft` from the command palette.
3. Reload VS Code if prompted.

### From source

1. Clone this repository.
2. Run `npm install` in the repo root.
3. Execute `npm run compile` to build `out/`.
4. Press `F5` in VS Code to launch an Extension Development Host with Context Craft loaded.

## Development workflow

- `npm run watch` – incremental TypeScript build that keeps `out/` in sync while you edit.
- `npm run compile` – single build for CI or packaging.
- `npm run lint` – ESLint (strict mode) over `src/`.
- `npm test` – compiles, lints, then runs VS Code tests via `@vscode/test-cli`.
- Debugging – launch the included `Extension` configuration from VS Code to attach to the development host.

## Testing

Project tests live under `src/test/` and `src/test/suite/` and run with Mocha via the VS Code test CLI. Use `npm test` locally or hook it into CI so packaging only occurs after tests pass. Add new suites near the module they cover and prefer deterministic unit tests (Sinon is available for fakes/timers).

## Project layout

```
context-craft/
├── src/                 # Extension source (entry: src/extension.ts)
│   ├── commands/        # Command registrations and implementations
│   ├── FileTreeProvider.ts
│   ├── selectionLogic.ts
│   ├── tokenCounter.ts
│   ├── getIgnoreParser.ts
│   └── utils.ts
├── resources/           # Icons for the activity bar + extension icon
├── out/                 # Compiled JavaScript (generated)
├── src/test/            # Mocha-style unit/integration tests
├── CHANGELOG.md         # Release notes
├── AGENTS.md            # Additional project documentation
└── LICENSE.md           # MIT license text
```

## Release checklist

1. Update `CHANGELOG.md` with the new version, date, and highlights.
2. Bump the version in `package.json` and ensure `engines.vscode` is still accurate.
3. Run `npm run lint`, `npm test`, and `npm run compile`.
4. Package with `npx @vscode/vsce package` (or `publish`).
5. Create a GitHub release that links to the Marketplace entry and includes the changelog excerpt.

## Troubleshooting

- **"No workspace folder open" warning** – Context Craft only works inside trusted folders. Open a folder or multi-root workspace first.
- **Git commands disabled** – ensure the built-in Git extension is enabled; Workspace Trust may need to be granted for Git to run.
- **Files missing from XML** – confirm the files are not matched by `.gitignore` and are under the 200 KB preview limit. Very large folders may hit the 10k-file safety cap.
- **Token count stuck on "Calculating…"** – expand fewer folders or wait for the previous refresh to finish; long scans are cancellable, so re-triggering will reset the counter.

## Contributing

Issues and pull requests are welcome! Please share reproduction steps, logs (from the `ContextCraft` prefix), and screenshots when reporting UI glitches. Follow the coding style outlined in [Repository Guidelines](./AGENTS.md) and include tests for new behavior whenever possible.

## License

Context Craft is released under the [MIT License](./LICENSE.md).
