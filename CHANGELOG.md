# Change Log

All notable changes to the "context-craft" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.3.4] - 2025-10-25

- Feature: full multi-root workspace support so every folder in a workspace gets its own Context Craft tree and command context.
- Fix: tightened selection syncing and workspace safeguards—block rename/delete on workspace roots, skip deleted or out-of-scope git changes, and prune stale selections when folders change.
- Docs: README now highlights CI/release status badges to clarify project health.

## [1.3.3] - 2025-09-22

- Dev: stop tracking workspace-specific VS Code settings and recommendations.

## [1.3.2] - 2025-08-21

- Fix: avoid recreating the TreeView during copy to prevent the view from resetting while copying selected files.

## [1.3.1] - 2025-08-19

- Fix: token/file counts now update reliably after selections, including large nested folders.
- Performance: cancellable refresh with sequence gating to discard stale work.
- Safety: cap traversal at 10,000 files to prevent out-of-memory crashes.
- UX: interim "Calculating…" message in status bar and tree header during processing.
- Logging: structured logs for selection changes, traversal, token counting, and ignore cache hits.

## [1.3.0] - 2025-08-18

- Performance: cache file children in file tree to speed browsing.
- UI: improved status bar and tree view updates; more accurate token counts.
- Docs: clearer installation and usage instructions.
- Dev: VS Code settings tweak for default bash terminal on macOS.


## [1.2.1] - 2025-05-17

- Update the icon and activity bar icon.

## [1.2.0] - 2025-05-16

- Added a "Refresh" button to the tree view title menu to manually refresh the file browser.

## [1.1.0] - 2025-05-15 

- Token count display: Shows estimated token count for selected files in the status bar and tree view message.
- Token numbers are formatted with thousand separators for readability.
- Improved TreeView message to include the count of selected files in addition to the token count (e.g., "N file(s) | M tokens").
- Updated status bar message to consistently display file and token counts or "No workspace" if a folder isn't open.

## [1.0.3] - 2025-05-14

- Fix: Always refresh the file tree on file creation, deletion, or change at the workspace root. This ensures top-level files and folders appear/disappear immediately without manual refresh.
