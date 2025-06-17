import ignore from "ignore";
import * as vscode from "vscode";
import { registerCopySelectedCommand } from "./commands/copySelected";
import { registerRefreshCommand } from "./commands/refresh";
import { registerUnselectAllCommand } from "./commands/unselectAll";
import { STATE_KEY_SELECTED } from "./constants";
import { debounce } from "./debounce";
import { FileTreeProvider } from "./FileTreeProvider";
import { getIgnoreParser } from "./getIgnoreParser";
import { toggleSelection } from "./selectionLogic";
import { countTokens } from "./tokenCounter";
import { collectFiles } from "./utils";

export let ignoreParserCache: Map<string, { parser: ReturnType<typeof ignore>, mtime: number }> = new Map();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	let fileTreeProvider: FileTreeProvider;
	let treeView: vscode.TreeView<vscode.Uri>;
	let tokenStatusBar: vscode.StatusBarItem;

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

	const debouncedRefreshAndUpdate = debounce(async () => {
		fileTreeProvider.refresh();
		
		const root = vscode.workspace.workspaceFolders?.[0]?.uri;
		if (!root) { 
			if (tokenStatusBar) {
				tokenStatusBar.text = `$(symbol-string) No workspace`;
			}
			if (treeView) {
				treeView.message = `No workspace folder`;
			}
			return; 
		}
		const resolvedFiles = await resolveSelectedFiles(fileTreeProvider, root);
		const numFiles = resolvedFiles.length;
		const tokens = await countTokens(resolvedFiles);

		const fileText = `${numFiles} file${numFiles === 1 ? "" : "s"}`;
		const tokenText = `${tokens.toLocaleString()} tokens`;

		if (tokenStatusBar) {
			tokenStatusBar.text = `$(symbol-string) ${fileText} | ${tokenText}`;
		}
		if (treeView) {
			treeView.message = `${fileText} | ${tokenText}`;
		}
	}, 200);

	const persisted: string[] =
		context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	fileTreeProvider = new FileTreeProvider(new Set(persisted), context, debouncedRefreshAndUpdate);

	treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});

	tokenStatusBar = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		95
	);
	tokenStatusBar.tooltip = "Tokens that will be copied by Context Craft";
	tokenStatusBar.show();
	context.subscriptions.push(tokenStatusBar);

	registerUnselectAllCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);
	registerCopySelectedCommand(context, fileTreeProvider, resolveSelectedFiles);
	registerRefreshCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);

	treeView.onDidChangeCheckboxState(async (event) => {
		const togglePromises: Promise<void>[] = [];

		for (const [clickedResourceUri, newState] of event.items) {
			togglePromises.push(
				toggleSelection(
					clickedResourceUri,
					newState === vscode.TreeItemCheckboxState.Checked,
					fileTreeProvider
				)
			);
		}

		await Promise.all(togglePromises);

		await context.workspaceState.update(
			STATE_KEY_SELECTED,
			Array.from(fileTreeProvider.checkedPaths)
		);

		debouncedRefreshAndUpdate();
	});

	debouncedRefreshAndUpdate();

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
                                                focus: true,
                                                expand: true
                                        }
                                ).then(undefined, (error: unknown) => {
                                        console.error("Could not reveal in tree:", error);
                                });
			}
		)
	);
}

export function deactivate(): void {
	// noop
}
