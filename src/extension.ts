import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";
import * as os from "os";
import ignore from "ignore";
import { getIgnoreParser } from "./getIgnoreParser";
import { collectFiles, isBinary } from "./utils";
import { toggleSelection } from "./selectionLogic";

const STATE_KEY_SELECTED = "contextCraft.selectedPaths";

export let ignoreParserCache: Map<string, { parser: ReturnType<typeof ignore>, mtime: number }> = new Map();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	/* ---------- provider & view ---------- */
	const persisted: string[] =
		context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	const fileTreeProvider = new FileTreeProvider(new Set(persisted));

	const treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});

	context.subscriptions.push(
		vscode.commands.registerCommand("contextCraft.unselectAll", async () => {
			fileTreeProvider.checkedPaths.clear();
			await context.workspaceState.update(STATE_KEY_SELECTED, []);
			fileTreeProvider.refresh();
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
			const ignoreParser = await getIgnoreParser(workspaceRootUri);
			const absoluteSelected = Array.from(fileTreeProvider.checkedPaths);
			let absoluteFiles: string[] = [];
			for (const abs of absoluteSelected) {
				const sub = await collectFiles(vscode.Uri.file(abs), ignoreParser, workspaceRootUri);
				absoluteFiles.push(...sub);
			}
			absoluteFiles = Array.from(new Set(absoluteFiles)).sort();
			if (absoluteFiles.length === 0) {
				vscode.window.showInformationMessage("No non-ignored files resolved.");
				return;
			}
			let xmlChunks: string[] = ["<code_files>"];
			for (const abs of absoluteFiles) {
				const rel = path.relative(workspaceRootUri.fsPath, abs);
				const fileName = path.basename(rel);
				const xmlPath  = rel.split(path.sep).join("/");
				if (await isBinary(abs)) {
					xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" binary="true"/>`);
					continue;
				}
				const bytes   = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
				if (bytes.byteLength > 200_000) {
					xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" truncated="true"/>`);
					continue;
				}
				const content = Buffer.from(bytes).toString("utf-8");
				const safe = content.replaceAll("]]>" , "]]]]><![CDATA[>");
				xmlChunks.push(
					`  <file name="${fileName}" path="${xmlPath}"><![CDATA[`,
					safe,
					`]]></file>`
				);
			}
			xmlChunks.push("</code_files>");
			const xmlPayload = xmlChunks.join(os.EOL);
			await vscode.env.clipboard.writeText(xmlPayload);
			vscode.window.showInformationMessage(`Copied ${absoluteFiles.length} file node(s).`);
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
	});

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(
			(activeTextEditor) => {
				if (activeTextEditor !== undefined) {
					const documentUri: vscode.Uri = activeTextEditor.document.uri;
					treeView.reveal(
						documentUri,
						{
							select: true,
							focus: false,
							expand: true
						}
					).then(
						() => {},
						(error) => {
							console.error("Could not reveal in tree:", error);
						}
					);
				}
			}
		)
	);
}

/* istanbul ignore next */
export function deactivate(): void {
	/* noop */
}
