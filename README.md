# Context Craft

**Cherry-pick the exact files you need and copy them to your clipboard as a clean XML payload—perfect for feeding an LLM without wasting tokens.**

---

## Features

- **Dedicated File Browser**  
  A separate activity-bar view that shows your workspace tree with check-boxes.

- **Smart Multi-Select**  
  Select an entire folder with one click; child and parent check-states stay in sync.

- **One-Click Clipboard Export**  
  `Copy Selected` turns the chosen files into:

  ```xml
  <code_files>
    <file name="app.ts" path="src/app.ts"><![CDATA[
      console.log("hello, world");
    ]]></file>
    <file name="logo.png" path="assets/logo.png" binary="true"/>
    <file name="massive.sql" path="db/massive.sql" truncated="true"/>
  </code_files>

Binary files are flagged; text files larger than 200 kB are truncated so you do not blow past token limits.
	•	Unselect All clears the slate instantly.
	•	Auto-Reveal Active File—jump to whatever you are editing.
	•	.gitignore Respect—ignored files never clutter the list.
	•	Session-Persistent Selection—your choices survive reloads.

⸻

Install

Marketplace
	1.	Press F1 → Extensions: Install Extensions.
	2.	Search for "Context Craft".
	3.	Hit Install—done.

From Source / VSIX

git clone https://github.com/YOUR-ORG/context-craft.git
cd context-craft
npm install
npm run compile
code --install-extension context-craft-0.0.1.vsix


⸻

Usage
	1.	Click the Context Craft icon in the activity bar.
	2.	Tick the files or folders you want.
	3.	Press the Copy Selected toolbar button or run the command from the palette (Ctrl + Shift + P).
	4.	Paste the XML anywhere—ChatGPT, Claude, a prompt file, etc.
	5.	Need a fresh start? Hit Unselect All.

⸻

Commands

Command ID	Title	Where to Find It
contextCraft.copySelected	Copy Selected	View toolbar · Command Palette
contextCraft.unselectAll	Unselect All	View toolbar · Command Palette

No keyboard shortcuts are pre-bound to avoid clashing with your setup. Add your own in File › Preferences › Keyboard Shortcuts if you like.

// example keybinding
{
  "key": "ctrl+shift+c",
  "command": "contextCraft.copySelected",
  "when": "view == contextCraftFileBrowser"
}


⸻

Known Limitations
	•	Only the first workspace folder is processed in a multi-root workspace.
	•	Nested .gitignore files are not parsed yet.
	•	Selections are stored per-workspace, not globally.

⸻

Contributing

Pull requests welcome—keep variable names explicit and wrap every control-flow block in braces.

npm install
npm run watch   # incremental TypeScript build
# Press F5 in VS Code to launch the Extension Host


⸻

License

MIT
