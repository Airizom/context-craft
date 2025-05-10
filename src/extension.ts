import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";

const STATE_KEY_SELECTED = "contextCraft.selectedPaths";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	/* ---------- provider & view ---------- */
	const savedPaths: string[] = context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	const fileTreeProvider = new FileTreeProvider(new Set(savedPaths));

	const treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});

	/* ---------- checkbox cascade ---------- */
	treeView.onDidChangeCheckboxState(async (event) => {
		for (const [item, newState] of event.items) {
			await handleCheckboxChange(item, newState === vscode.TreeItemCheckboxState.Checked);
		}
		fileTreeProvider.refresh();
		void context.workspaceState.update(STATE_KEY_SELECTED, Array.from(fileTreeProvider.checkedPaths));
	});

	async function handleCheckboxChange(uri: vscode.Uri, isChecked: boolean): Promise<void> {
		const absolutePath: string = uri.fsPath;
		if (isChecked) {
			fileTreeProvider.checkedPaths.add(absolutePath);
		} else {
			fileTreeProvider.checkedPaths.delete(absolutePath);
		}
		if (await isDirectory(uri)) {
			const descendants: vscode.Uri[] = await collectDescendants(uri);
			for (const descendant of descendants) {
				if (isChecked) {
					fileTreeProvider.checkedPaths.add(descendant.fsPath);
				} else {
					fileTreeProvider.checkedPaths.delete(descendant.fsPath);
				}
			}
		} else if (!isChecked) {
			await maybeUncheckEmptyParent(uri);
		}
	}

	async function collectDescendants(root: vscode.Uri): Promise<vscode.Uri[]> {
		return vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Window,
				title: `Selecting “${path.basename(root.fsPath)}”…`,
				cancellable: false
			},
			async (progress) => {
				const collected: vscode.Uri[] = [];
				const directoryQueue: vscode.Uri[] = [root];
				const batchSize: number = 64;
				while (directoryQueue.length > 0) {
					const workBatch: vscode.Uri[] = directoryQueue.splice(0, batchSize);
					const batchResults: Array<[readonly [string, vscode.FileType][], vscode.Uri]> =
						await Promise.all(
							workBatch.map(async (directory) => {
								const entries = await vscode.workspace.fs.readDirectory(directory);
								return [entries, directory] as const;
							})
						);
					for (const [entries, directory] of batchResults) {
						for (const [name, fileType] of entries) {
							const child: vscode.Uri = vscode.Uri.joinPath(directory, name);
							collected.push(child);
							fileTreeProvider.kindCache.set(child.fsPath, fileType);
							if (fileType === vscode.FileType.Directory) {
								directoryQueue.push(child);
							}
						}
					}
					progress.report({
						message: `${collected.length.toLocaleString()} items scanned`
					});
				}
				return collected;
			}
		);
	}

	async function maybeUncheckEmptyParent(uri: vscode.Uri): Promise<void> {
		const parentUri: vscode.Uri | undefined = await getParent(uri);
		if (parentUri === undefined) {
			return;
		}
		if (await isDirectory(parentUri)) {
			const children: vscode.Uri[] = await fileTreeProvider.getChildren(parentUri);
			const anyChildChecked: boolean = children.some(
				(child) => fileTreeProvider.checkedPaths.has(child.fsPath)
			);
			if (!anyChildChecked) {
				fileTreeProvider.checkedPaths.delete(parentUri.fsPath);
			}
		}
	}

	/* ---------- delete command ---------- */
	context.subscriptions.push(
		vscode.commands.registerCommand(
			"contextCraftFileBrowser.deleteItem",
			async (target?: vscode.Uri, multi?: vscode.Uri[]) => {
				const urisToDelete: vscode.Uri[] =
					multi?.length ? multi : target ? [target] : Array.from(fileTreeProvider.checkedPaths).map(vscode.Uri.file);

				for (const uri of urisToDelete) {
					try {
						await vscode.workspace.fs.delete(uri, { recursive: true, useTrash: true });
					} catch (err) {
						const message: string = `Delete failed for ${uri.fsPath}: ${String(err)}`;
						void vscode.window.showErrorMessage(message);
					}
				}
				fileTreeProvider.refresh();
			}
		)
	);
}

/* ---------- helpers ---------- */

async function isDirectory(uri: vscode.Uri): Promise<boolean> {
	try {
		const stat: vscode.FileStat = await vscode.workspace.fs.stat(uri);
		return stat.type === vscode.FileType.Directory;
	} catch {
		return false;
	}
}

async function getParent(uri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const parentPath: string = path.dirname(uri.fsPath);
	if (parentPath === uri.fsPath) {
		return undefined;
	}
	return vscode.Uri.file(parentPath);
}

/* istanbul ignore next */
export function deactivate(): void {
	/* noop */
}
