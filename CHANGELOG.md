# Change Log

All notable changes to the "context-craft" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [Unreleased]

## [1.1.0] - 2025-05-15 

- Token count display: Shows estimated token count for selected files in the status bar and tree view message.
- Token numbers are formatted with thousand separators for readability.
- Improved TreeView message to include the count of selected files in addition to the token count (e.g., "N file(s) | M tokens").
- Updated status bar message to consistently display file and token counts or "No workspace" if a folder isn't open.

## [1.0.3] - 2025-05-14

- Fix: Always refresh the file tree on file creation, deletion, or change at the workspace root. This ensures top-level files and folders appear/disappear immediately without manual refresh.
