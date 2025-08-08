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
		fileTree: FileTreeProvider
	): Promise<string[]> {
		const selections = Array.from(fileTree.checkedPaths);
		const byRoot = new Map<string, { root: vscode.Uri; uris: vscode.Uri[] }>();
		for (const sel of selections) {
			const uri = vscode.Uri.file(sel);
			const ws = vscode.workspace.getWorkspaceFolder(uri);
			if (!ws) { continue; }
			const key = ws.uri.fsPath;
			if (!byRoot.has(key)) {
				byRoot.set(key, { root: ws.uri, uris: [] });
			}
			byRoot.get(key)!.uris.push(uri);
		}

		const nestedPerRoot: string[][] = await Promise.all(
			Array.from(byRoot.values()).map(async (group) => {
				const ignoreParser = await getIgnoreParser(group.root);
				const nestedArrays = await Promise.all(
					group.uris.map(async (uri) => {
						try {
							return await collectFiles(uri, ignoreParser, group.root);
						} catch (error) {
							console.error("collectFiles failed for selection", uri.fsPath, error);
							return [] as string[];
						}
					})
				);
				return nestedArrays.flat();
			})
		);

		const files = nestedPerRoot.flat();
		return Array.from(new Set(files));
	}

    const updateUi = (filesCount: number, tokensCount: number) => {
        const fileText = `${filesCount} file${filesCount === 1 ? "" : "s"}`;
        const tokenText = `${tokensCount.toLocaleString()} tokens`;
        if (tokenStatusBar) {
            tokenStatusBar.text = `$(symbol-string) ${fileText} | ${tokenText}`;
        }
        if (treeView) {
            treeView.message = `${fileText} | ${tokenText}`;
        }
    };
	const debouncedRefreshAndUpdate = debounce(async () => {
		fileTreeProvider.refresh();
		const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
		if (!hasWorkspace) {
            if (tokenStatusBar) {
                tokenStatusBar.text = `$(symbol-string) No workspace`;
            }
            if (treeView) {
                treeView.message = `No workspace folder`;
            }
            return;
        }
		const resolvedFiles = await resolveSelectedFiles(fileTreeProvider);
        const filesCount = resolvedFiles.length;
        const tokens = await countTokens(resolvedFiles);
        updateUi(filesCount, tokens);
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
    tokenStatusBar.text = `$(symbol-string) 0 files | 0 tokens`;
	context.subscriptions.push(tokenStatusBar);

	registerUnselectAllCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);
	registerCopySelectedCommand(context, fileTreeProvider, resolveSelectedFiles);
	registerRefreshCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);

		treeView.onDidChangeCheckboxState(async (event) => {
			try {
				const togglePromises: Promise<void>[] = [];
				for (const item of event.items as any) {
					const element = Array.isArray(item) ? item[0] : item.element;
					const checkboxState = Array.isArray(item) ? item[1] : item.checkboxState;
					togglePromises.push(
						toggleSelection(
							element,
							checkboxState === vscode.TreeItemCheckboxState.Checked,
							fileTreeProvider
						)
					);
				}
				await Promise.all(togglePromises);
				await context.workspaceState.update(
					STATE_KEY_SELECTED,
					Array.from(fileTreeProvider.checkedPaths)
				);
			} catch (error) {
				console.error("Checkbox handler failed:", error);
			} finally {
				debouncedRefreshAndUpdate();
			}
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
