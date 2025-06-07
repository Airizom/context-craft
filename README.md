# Context Craft

Cherry‑pick files in VS Code and copy them to your clipboard as a clean XML payload—perfect for LLM prompts.

---

## Why?

Stop wasting tokens on boilerplate. Context Craft lets you send only the code that matters.

---

## Key Features

- **Checkbox File/Folder Picker** in a dedicated sidebar view  
- **Live Token Estimate** in both the view header and status bar  
- **One‑Click "Copy as XML"**—straight to your clipboard  
- **`.gitignore`‑Aware**; binary files flagged, files > 200 kB truncated  
- **Selection Persists** across reloads  
- **Unselect All** and **Auto‑Reveal Active File** commands  

---

## Installation

### VS Code Marketplace

1. Press **F1** → *Extensions: Install Extensions*  
2. Search **Context Craft** → **Install**

### From Source

```bash
git clone https://github.com/Airizom/context-craft.git
cd context-craft
npm install
npm run compile
code --install-extension context-craft-*.vsix
```

---

## Usage

1. Click the **Context Craft** icon in the activity bar.
2. Tick the files or folders to include.
3. Hit **Copy Selected** (toolbar or `Ctrl+Shift+P`).
4. Paste the XML wherever you need it.

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

---

## Commands

| Title         | Palette ID                  | Default Shortcut |
| ------------- | --------------------------- | ---------------- |
| Copy Selected | `contextCraft.copySelected` | —                |
| Unselect All  | `contextCraft.unselectAll`  | —                |
| Refresh       | `contextCraft.refresh`      | —                |

Add your own keybindings in **keybindings.json**:

```jsonc
{
  "key": "ctrl+shift+c",
  "command": "contextCraft.copySelected",
  "when": "view == contextCraftFileBrowser"
}
```

---

## Limitations

* Only the first workspace folder is processed in multi‑root workspaces.
* Nested `.gitignore` files are ignored (top‑level only).

---

## Contributing

Pull requests welcome—use explicit variable names and wrap every control‑flow block in braces.

```bash
npm install
npm run watch   # incremental TypeScript build
# Press F5 in VS Code to launch the Extension Host
```

---

## License

MIT

---

## Support

Open issues or feature requests on the [GitHub tracker](https://github.com/Airizom/context-craft/issues).
