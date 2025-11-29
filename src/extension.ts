import ignore from "ignore";
import * as vscode from "vscode";
import { registerCopySelectedCommand } from "./commands/copySelected";
import { registerRefreshCommand } from "./commands/refresh";
import { registerUnselectAllCommand } from "./commands/unselectAll";
import { registerSelectGitChangesCommand } from "./commands/selectGitChanges";
import { registerOpenFileCommand } from "./commands/openFile";
import { registerOpenToSideCommand } from "./commands/openToSide";
import { registerRevealInOSCommand } from "./commands/revealInOS";
import { registerOpenInTerminalCommand } from "./commands/openInTerminal";
import { registerCopyPathCommand } from "./commands/copyPath";
import { registerCopyRelativePathCommand } from "./commands/copyRelativePath";
import { registerRenameFileCommand } from "./commands/renameFile";
import { registerDeleteFileCommand } from "./commands/deleteFile";
import { updateSelectedPaths } from "./commands/commandUtils";
import { STATE_KEY_SELECTED, MAX_COLLECTED_FILES } from "./constants";
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
    let currentAbort: AbortController | undefined;
    let refreshSeq = 0;
    

	async function resolveSelectedFiles(
		fileTree: FileTreeProvider,
		_root?: vscode.Uri,
		signal?: AbortSignal
	): Promise<string[]> {
		const selections = Array.from(fileTree.checkedPaths);
		console.log(`[ContextCraft] resolveSelectedFiles selections=${selections.length}`);
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

		console.log(`[ContextCraft] resolveSelectedFiles roots=${byRoot.size}`);
		for (const [key, group] of byRoot) {
			console.log(`[ContextCraft]  root=${key} selections=${group.uris.length}`);
		}

        const nestedPerRoot: string[][] = await Promise.all(
            Array.from(byRoot.values()).map(async (group) => {
                const ignoreParser = await getIgnoreParser(group.root);
                const capCounter = { count: 0 };
                const nestedArrays = await Promise.all(
                    group.uris.map(async (uri) => {
                        try {
                            const tSel0 = Date.now();
                            const filesForSel = await collectFiles(
                                uri,
                                ignoreParser,
                                group.root,
                                signal,
                                MAX_COLLECTED_FILES,
                                capCounter
                            );
                            const tSel1 = Date.now();
                            console.log(`[ContextCraft]  collected ${filesForSel.length} files from ${uri.fsPath} in ${tSel1 - tSel0}ms`);
                            return filesForSel;
                        } catch (error) {
                            console.error("[ContextCraft] collectFiles failed for selection", uri.fsPath, error);
                            return [] as string[];
                        }
                    })
                );
                if (capCounter.count >= MAX_COLLECTED_FILES) {
                    console.warn(`[ContextCraft] traversal capped at ${MAX_COLLECTED_FILES} files for root ${group.root.fsPath}`);
                }
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

	const setCalculatingUi = (hint?: string) => {
		const text = hint ? `Calculating… ${hint}` : "Calculating…";
		if (tokenStatusBar) {
			tokenStatusBar.text = `$(sync~spin) ${text}`;
		}
		if (treeView) {
			treeView.message = text;
		}
	};

	// Extracted so we can also call immediately when needed
	const refreshAndUpdate = async () => {
		const mySeq = ++refreshSeq;
		try { currentAbort?.abort(); } catch {}
		currentAbort = new AbortController();
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

		const checkedCount = fileTreeProvider.checkedPaths.size;
		console.log(`[ContextCraft] refresh start seq=${mySeq} checked=${checkedCount}`);
		setCalculatingUi(checkedCount > 0 ? `${checkedCount} selected` : undefined);
		const t0 = Date.now();
		const resolvedFiles = await resolveSelectedFiles(fileTreeProvider, undefined, currentAbort.signal);
		if (mySeq !== refreshSeq) { return; }
		const t1 = Date.now();
		console.log(`[ContextCraft] resolveSelectedFiles seq=${mySeq} files=${resolvedFiles.length} in ${t1 - t0}ms`);
		const filesCount = resolvedFiles.length;
		const t2 = Date.now();
		const tokens = await countTokens(resolvedFiles, currentAbort.signal);
		if (mySeq !== refreshSeq) { return; }
		const t3 = Date.now();
		console.log(`[ContextCraft] countTokens seq=${mySeq} totalTokens=${tokens} in ${t3 - t2}ms (total ${t3 - t0}ms)`);
		updateUi(filesCount, tokens);
	};

	const debouncedRefreshAndUpdate = debounce(refreshAndUpdate, 200);

	const handleWorkspaceFoldersChanged = async () => {
		console.log("[ContextCraft] Workspace folders changed, pruning selections and refreshing tree");
		const selectionsPruned = pruneSelectionsOutsideWorkspace(fileTreeProvider);
		if (selectionsPruned) {
			await context.workspaceState.update(
				STATE_KEY_SELECTED,
				Array.from(fileTreeProvider.checkedPaths)
			);
		}
		debouncedRefreshAndUpdate();
	};

    

	const persisted: string[] =
		context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	fileTreeProvider = new FileTreeProvider(new Set(persisted), context, debouncedRefreshAndUpdate);

	treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});
	context.subscriptions.push(treeView);

	const focusActiveEditorInTree = (options?: { skipIfSelected?: boolean }) => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}
		const documentUri = activeEditor.document.uri;
		if (documentUri.scheme !== "file") {
			return;
		}
		if (!vscode.workspace.getWorkspaceFolder(documentUri)) {
			return;
		}
		if (options?.skipIfSelected) {
			const alreadySelected = treeView.selection.some(
				(selectedUri) => selectedUri.fsPath === documentUri.fsPath
			);
			if (alreadySelected) {
				return;
			}
		}
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
	};

	tokenStatusBar = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		95
	);
	tokenStatusBar.tooltip = "Tokens that will be copied by Context Craft";
    tokenStatusBar.show();
    tokenStatusBar.text = `$(symbol-string) 0 files | 0 tokens`;
	context.subscriptions.push(tokenStatusBar);

	registerUnselectAllCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);
	registerSelectGitChangesCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);
	registerCopySelectedCommand(context, fileTreeProvider, resolveSelectedFiles);
	registerRefreshCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);
	registerOpenFileCommand(context);
	registerOpenToSideCommand(context);
	registerRevealInOSCommand(context);
	registerOpenInTerminalCommand(context);
	registerCopyPathCommand(context);
	registerCopyRelativePathCommand(context);
	registerRenameFileCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);
	registerDeleteFileCommand(context, fileTreeProvider, debouncedRefreshAndUpdate);

		const checkboxDisposable = treeView.onDidChangeCheckboxState(async (event) => {
			try {
				const togglePromises: Promise<void>[] = [];
				console.log(`[ContextCraft] checkbox change items=${event.items.length}`);
				for (const [element, checkboxState] of event.items) {
					togglePromises.push(
						toggleSelection(
							element,
							checkboxState === vscode.TreeItemCheckboxState.Checked,
							fileTreeProvider
						)
					);
				}
				await Promise.all(togglePromises);
				console.log(`[ContextCraft] checkbox toggled; checkedPaths.size=${fileTreeProvider.checkedPaths.size}`);
				// Persist selection state, but do not block UI updates
				void updateSelectedPaths(context, fileTreeProvider).then(undefined, (err: unknown) => console.error("[ContextCraft] workspaceState update failed", err));
			} catch (error) {
				console.error("[ContextCraft] Checkbox handler failed:", error);
			} finally {
				await refreshAndUpdate();
			}
		});
	context.subscriptions.push(checkboxDisposable);

	const visibilityDisposable = treeView.onDidChangeVisibility((event) => {
		if (!event.visible) {
			return;
		}
		focusActiveEditorInTree({ skipIfSelected: true });
	});
	context.subscriptions.push(visibilityDisposable);

	if (treeView.visible) {
		focusActiveEditorInTree({ skipIfSelected: true });
	}

	debouncedRefreshAndUpdate();

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			if (!treeView.visible) {
				return;
			}
			focusActiveEditorInTree({ skipIfSelected: true });
		})
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			void handleWorkspaceFoldersChanged();
		})
	);
}

export function deactivate(): void {
	// noop
}

function pruneSelectionsOutsideWorkspace(fileTreeProvider: FileTreeProvider): boolean {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	if (workspaceFolders.length === 0) {
		if (fileTreeProvider.checkedPaths.size === 0) {
			return false;
		}
		fileTreeProvider.checkedPaths.clear();
		return true;
	}
	let changed = false;
	for (const fsPath of Array.from(fileTreeProvider.checkedPaths)) {
		const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
		if (!folder) {
			fileTreeProvider.checkedPaths.delete(fsPath);
			changed = true;
		}
	}
	return changed;
}
