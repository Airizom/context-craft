import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";

const STATE_KEY_SELECTED = "contextCraft.selectedPaths";

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

	/* ---------- checkbox cascade ---------- */
	treeView.onDidChangeCheckboxState(async (event) => {
		for (const [clickedResourceUri, newState] of event.items) {
			await toggleSelection(clickedResourceUri, newState === vscode.TreeItemCheckboxState.Checked);
		}
		fileTreeProvider.refresh();
		void context.workspaceState.update(
			STATE_KEY_SELECTED,
			Array.from(fileTreeProvider.checkedPaths)
		);
	});

	async function toggleSelection(target: vscode.Uri, isChecked: boolean): Promise<void> {
		const absolutePath: string = target.fsPath;
		const STARTS_WITH_SEP = absolutePath + path.sep;

		if (isChecked) {
			fileTreeProvider.checkedPaths.add(absolutePath);
			for (const filePath of Array.from(fileTreeProvider.checkedPaths)) {
				if (filePath !== absolutePath && filePath.startsWith(STARTS_WITH_SEP)) {
					fileTreeProvider.checkedPaths.delete(filePath);
				}
			}
		} else {
			fileTreeProvider.checkedPaths.delete(absolutePath);
		}

		await rebalanceParents(target);
	}

	async function rebalanceParents(startLeaf: vscode.Uri): Promise<void> {
		let cursor: vscode.Uri | undefined = await getParent(startLeaf);
		while (cursor !== undefined) {
			const children: vscode.Uri[] = await fileTreeProvider.getChildren(cursor);
			let checkedCount: number = 0;
			let uncheckedCount: number = 0;

			for (const child of children) {
				const childPath: string = child.fsPath;
				if (fileTreeProvider.checkedPaths.has(childPath)) {
					checkedCount += 1;
				} else {
					if (hasSelectedAncestor(child)) {
						checkedCount += 1;
					} else {
						uncheckedCount += 1;
					}
				}
			}

			const parentPath: string = cursor.fsPath;
			if (checkedCount === 0) {
				fileTreeProvider.checkedPaths.delete(parentPath);
			} else if (uncheckedCount === 0) {
				fileTreeProvider.checkedPaths.add(parentPath);
			} else {
				fileTreeProvider.checkedPaths.delete(parentPath);
			}

			cursor = await getParent(cursor);
		}
	}

	function hasSelectedAncestor(target: vscode.Uri): boolean {
		let current: vscode.Uri | undefined = target;
		while (current !== undefined) {
			if (fileTreeProvider.checkedPaths.has(current.fsPath)) {
				return true;
			}
			current = path.dirname(current.fsPath) === current.fsPath
				? undefined
				: vscode.Uri.file(path.dirname(current.fsPath));
		}
		return false;
	}
}

/* ---------- helpers ---------- */

async function getParent(resourceUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const parentPath: string = path.dirname(resourceUri.fsPath);
	if (parentPath === resourceUri.fsPath) {
		return undefined;
	}
	return vscode.Uri.file(parentPath);
}

/* istanbul ignore next */
export function deactivate(): void {
	/* noop */
}
