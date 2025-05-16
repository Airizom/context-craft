import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";
import * as os from "os";
import ignore from "ignore";
import { getIgnoreParser } from "./getIgnoreParser";
import { collectFiles, isBinary } from "./utils";
import { debounce } from "./debounce";
import { toggleSelection } from "./selectionLogic";
import { countTokens } from "./tokenCounter";

const STATE_KEY_SELECTED = "contextCraft.selectedPaths";

export let ignoreParserCache: Map<string, { parser: ReturnType<typeof ignore>, mtime: number }> = new Map();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	/* ---------- provider & view ---------- */
	const persisted: string[] =
		context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	const fileTreeProvider = new FileTreeProvider(new Set(persisted), context);

	const treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});

	const tokenStatusBar = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		95
	);
	tokenStatusBar.tooltip = "Tokens that will be copied by Context Craft";
	tokenStatusBar.show();
	context.subscriptions.push(tokenStatusBar);

	async function resolveSelectedFiles(
		fileTree: FileTreeProvider,
		root: vscode.Uri
	): Promise<string[]> {
		const ignoreParser = await getIgnoreParser(root);
		let files: string[] = [];
		for (const sel of fileTree.checkedPaths) {
			files.push(...await collectFiles(vscode.Uri.file(sel), ignoreParser, root));
		}
		return Array.from(new Set(files));
	}

	const debouncedUpdate = debounce(async () => {
		const root = vscode.workspace.workspaceFolders?.[0]?.uri;
		if (!root) { 
			tokenStatusBar.text = `$(symbol-string) No workspace`;
			treeView.message = `No workspace folder`;
			return; 
		}
		const resolvedFiles = await resolveSelectedFiles(fileTreeProvider, root);
		const numFiles = resolvedFiles.length;
		const tokens = await countTokens(resolvedFiles);

		const fileText = `${numFiles} file${numFiles === 1 ? "" : "s"}`;
		const tokenText = `${tokens.toLocaleString()} tokens`;

		tokenStatusBar.text = `$(symbol-string) ${fileText} | ${tokenText}`;
		treeView.message = `${fileText} | ${tokenText}`;
	}, 200);

	context.subscriptions.push(
		vscode.commands.registerCommand("contextCraft.unselectAll", async () => {
			fileTreeProvider.checkedPaths.clear();
			await context.workspaceState.update(STATE_KEY_SELECTED, []);
			fileTreeProvider.refresh();
			debouncedUpdate();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("contextCraft.copySelected", async () => {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showWarningMessage(
					"No workspace folder open. Cannot copy selected files."
				);
				return;
			}
			if (workspaceFolders.length > 1) {
				vscode.window.showWarningMessage(
					"Multi-root workspaces are not fully supported. Only the first root will be used."
				);
			}
			const workspaceRootUri = workspaceFolders[0].uri;
			const absoluteFiles = (await resolveSelectedFiles(fileTreeProvider, workspaceRootUri)).sort();

			if (absoluteFiles.length === 0) {
				vscode.window.showInformationMessage("No non-ignored files resolved.");
				return;
			}
			let xmlChunks: string[] = ["<code_files>"];
			for (const abs of absoluteFiles) {
				const rel = path.relative(workspaceRootUri.fsPath, abs);
				const fileName = path.basename(rel);
				const xmlPath = rel.split(path.sep).join("/");
				
				if (await isBinary(abs)) {
					xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" binary="true"/>`);
					continue;
				}

				try {
					const stats = await vscode.workspace.fs.stat(vscode.Uri.file(abs));
					if (stats.size > 200_000) {
						xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" truncated="true"/>`);
						continue;
					}
				} catch (statError) {
					console.error(`Error stating file ${abs} for XML generation:`, statError);
					xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" error="true" comment="Error checking file size"/>`);
					continue;
				}

				const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
				const original = Buffer.from(bytes).toString("utf-8");
				const escaped = original.replaceAll("]]>" , "]]]]><![CDATA[>");
				xmlChunks.push(
					`  <file name="${fileName}" path="${xmlPath}"><![CDATA[`,
					escaped,
					`]]></file>`
				);
			}
			xmlChunks.push("</code_files>");
			const xmlPayload = xmlChunks.join(os.EOL);
			const tokenCount = await countTokens(absoluteFiles);
			await vscode.env.clipboard.writeText(xmlPayload);
			vscode.window.showInformationMessage(
				`Copied ${absoluteFiles.length} file${absoluteFiles.length === 1 ? "" : "s"} ` +
				`(${tokenCount} tokens) as XML. Paste anywhere to share or prompt an LLM.`
			);
		})
	);

	/* ---------- checkbox cascade ---------- */
	treeView.onDidChangeCheckboxState(async (event) => {
		for (const [clickedResourceUri, newState] of event.items) {
			await toggleSelection(clickedResourceUri, newState === vscode.TreeItemCheckboxState.Checked, fileTreeProvider);
		}
		fileTreeProvider.refresh();
		void context.workspaceState.update(
			STATE_KEY_SELECTED,
			Array.from(fileTreeProvider.checkedPaths)
		);
		debouncedUpdate();
	});

	debouncedUpdate();

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(
			(activeTextEditor) => {
				if (activeTextEditor === undefined) {
					return;
				}
				if (!treeView.visible) {
					return;
				}
				const documentUri = activeTextEditor.document.uri;
				treeView.reveal(
					documentUri,
					{
						select: true,
						focus: false,
						expand: true
					}
				).then(undefined, (error: unknown) => {
					console.error("Could not reveal in tree:", error);
				});
			}
		)
	);
}

/* istanbul ignore next */
export function deactivate(): void {
	/* noop */
}
