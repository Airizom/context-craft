# Context Craft

**Cherry-pick exactly the files you need and copy them to your clipboard as a clean XML payload—perfect for LLM prompts.**

---

## Overview
 
Context Craft is a VS Code extension that lets you select files or folders from your workspace and export them as a structured XML payload. This is ideal for sharing code with LLMs (like ChatGPT or Claude) without wasting tokens on unnecessary files.

---

## Features

- **Dedicated File Browser**: Separate activity-bar view with workspace tree and checkboxes
- **Smart Multi-Select**: Select folders or files; parent/child check-states sync automatically
- **One-Click Clipboard Export**: Export selected files as XML with a single click
- **Binary & Large File Handling**: Binary files flagged; large files (over 200 kB) are truncated
- **Unselect All**: Instantly clear your selection
- **Auto-Reveal Active File**: Jump to the file you are editing
- **.gitignore Respect**: Ignored files never clutter the list
- **Session-Persistent Selection**: Selections survive reloads

---

## Installation

### From Marketplace
1. Press `F1` → Extensions: Install Extensions
2. Search for **Context Craft**
3. Click **Install**

### From Source / VSIX
```sh
git clone https://github.com/Airizom/context-craft.git
cd context-craft
npm install
npm run compile
code --install-extension context-craft-1.0.0.vsix
```

---

## Usage

1. Click the **Context Craft** icon in the activity bar
2. Tick the files or folders you want
3. Press the **Copy Selected** toolbar button or run the command from the palette (`Ctrl+Shift+P`)
4. Paste the XML anywhere—ChatGPT, Claude, a prompt file, etc.
5. Need a fresh start? Hit **Unselect All**

---

## How it Works

Selected files are exported as XML:

```xml
<code_files>
  <file name="app.ts" path="src/app.ts"><![CDATA[
    console.log("hello, world");
  ]]></file>
  <file name="logo.png" path="assets/logo.png" binary="true"/>
  <file name="massive.sql" path="db/massive.sql" truncated="true"/>
</code_files>
```
- Binary files are flagged
- Text files over 200 kB are truncated

---

## Commands & Keybindings

| Command ID                  | Title         | Where to Find It                        |
|-----------------------------|---------------|-----------------------------------------|
| contextCraft.copySelected   | Copy Selected | View toolbar · Command Palette          |
| contextCraft.unselectAll    | Unselect All  | View toolbar · Command Palette          |

No keyboard shortcuts are pre-bound. To add your own:

```json
{
  "key": "ctrl+shift+c",
  "command": "contextCraft.copySelected",
  "when": "view == contextCraftFileBrowser"
}
```

---

## Known Limitations

- Only the first workspace folder is processed in a multi-root workspace
- Nested `.gitignore` files are not parsed yet
- Selections are stored per-workspace, not globally

---

## Contributing

Pull requests welcome. Please keep variable names explicit and wrap every control-flow block in braces.

```sh
npm install
npm run watch   # incremental TypeScript build
# Press F5 in VS Code to launch the Extension Host
```

---

## License

MIT

---

## Support

For issues or feature requests, please [open an issue](https://github.com/Airizom/context-craft/issues) on GitHub.
