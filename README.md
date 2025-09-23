## Context Craft

[![CI](https://github.com/Airizom/context-craft/actions/workflows/publish-vscode-extension.yml/badge.svg)](https://github.com/Airizom/context-craft/actions/workflows/publish-vscode-extension.yml) [![Release](https://img.shields.io/github/v/release/Airizom/context-craft.svg?logo=github)](https://github.com/Airizom/context-craft/releases)

Cherry‑pick files in VS Code and copy them to your clipboard as a clean XML payload—perfect for LLM prompts.

---

### Why?

Stop wasting tokens on boilerplate. Context Craft lets you send only the code that matters.

---

### Key features

- **Checkbox file/folder picker** in a dedicated sidebar view
- **Live token estimate** in the status bar and view header; updates as you select files or the workspace changes
- **One‑click "Copy as XML"** with safe CDATA handling
- **`.gitignore`‑aware collection** (top‑level `.gitignore` per workspace root)
- **Binary detection** and **large‑file truncation** (files > 200 kB marked `truncated="true"`)
- **Selection persists** across reloads
- **Refresh**, **Unselect All**, and **auto‑reveal active file** when the view is visible

---

### Installation

#### VS Code Marketplace

1. Press F1 → Extensions: Install Extensions
2. Search for “Context Craft” → Install

#### From source

Development (recommended):

```bash
git clone https://github.com/Airizom/context-craft.git
cd context-craft
npm install
npm run watch
# In VS Code: Run → Start Debugging (F5) to launch the Extension Development Host
```

Package a VSIX (optional):

```bash
npm install
npx @vscode/vsce package
code --install-extension context-craft-*.vsix
```

Requirements: VS Code 1.96+.

---

### Usage

1. Click the “Context Craft” icon in the Activity Bar.
2. Tick files or folders to include. Token totals update live.
3. Click “Copy Selected” (toolbar or Command Palette).
4. Paste the XML where you need it.

Example output:

```xml
<code_files>
  <file name="app.ts" path="src/app.ts"><![CDATA[
    console.log("hello");
  ]]></file>
  <file name="logo.png" path="assets/logo.png" binary="true"/>
  <file name="big.sql" path="db/big.sql" truncated="true"/>
</code_files>
```

Notes:
- `binary="true"` marks files containing binary content (detected via NUL bytes).
- `truncated="true"` marks files over 200 kB; their contents are omitted from the payload and token count.

---

### Commands

| Title | Palette ID | Default Shortcut |
| --- | --- | --- |
| Copy Selected | `contextCraft.copySelected` | — |
| Unselect All | `contextCraft.unselectAll` | — |
| Refresh | `contextCraft.refresh` | — |

Add your own keybindings in `keybindings.json`:

```jsonc
{
  "key": "ctrl+shift+c",
  "command": "contextCraft.copySelected",
  "when": "view == contextCraftFileBrowser"
}
```

---

### Token counting

- Uses `gpt-tokenizer` with `cl100k_base` (approx. GPT‑4/GPT‑3.5 tokenization)
- Binary files and files > 200 kB are excluded from the token estimate
- The status bar and view header display “N files | M tokens” for the current selection

---

### Ignore behavior

- Collection respects the top‑level `.gitignore` in each workspace root
- The tree view itself shows all files; filtering happens when collecting for copy/token count
- Multi‑root workspaces are partially supported: files can be selected across roots, but relative `path` values in the XML are computed from the first root

---

### Development

```bash
npm install
npm run watch          # incremental TypeScript build
npm run lint           # lint source
npm test               # run tests
```

See `src/test` for the test suite. The extension depends on the built‑in Git extension (`vscode.git`).

---

### Limitations

- Only top‑level `.gitignore` is used (nested `.gitignore` files are not parsed)
- Multi‑root: relative `path` attributes in XML are derived from the first root

---

### License

MIT

---

### Support

Open issues or feature requests on the GitHub tracker: `https://github.com/Airizom/context-craft/issues`

See the changelog at `CHANGELOG.md`.
