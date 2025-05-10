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

	context.subscriptions.push(
		vscode.commands.registerCommand("contextCraft.unselectAll", async () => {
			fileTreeProvider.checkedPaths.clear();
			await context.workspaceState.update(STATE_KEY_SELECTED, []);
			fileTreeProvider.refresh();
		})
	);

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
		const targetPath: string = target.fsPath;
		const startsWithSep: string = targetPath + path.sep;

		if (isChecked) {
			fileTreeProvider.checkedPaths.add(targetPath);

			for (const pathInSet of Array.from(fileTreeProvider.checkedPaths)) {
				if (pathInSet !== targetPath && pathInSet.startsWith(startsWithSep)) {
					fileTreeProvider.checkedPaths.delete(pathInSet);
				}
			}
		} else {
			fileTreeProvider.checkedPaths.delete(targetPath);
			for (const pathInSet of Array.from(fileTreeProvider.checkedPaths)) {
				if (pathInSet.startsWith(startsWithSep)) {
					fileTreeProvider.checkedPaths.delete(pathInSet);
				}
			}
			const selectedAncestors: vscode.Uri[] = findAllSelectedAncestors(target);
			for (const ancestor of selectedAncestors) {
				fileTreeProvider.checkedPaths.delete(ancestor.fsPath);
			}
			if (selectedAncestors.length > 0) {
				const topMost: vscode.Uri = selectedAncestors[selectedAncestors.length - 1];
				await reselectSiblingsExcept(topMost, targetPath);
			}
		}

		await rebalanceParents(target);
	}

	async function reselectSiblingsExcept(parent: vscode.Uri, excludedPath: string): Promise<void> {
		const directChildren: vscode.Uri[] = await fileTreeProvider.getChildren(parent);

		for (const child of directChildren) {
			const childPath: string = child.fsPath;

			if (childPath === excludedPath) {
				continue;
			}
			if (excludedPath.startsWith(childPath + path.sep)) {
				continue;
			}
			fileTreeProvider.checkedPaths.add(childPath);
		}
	}

	function findAllSelectedAncestors(descendant: vscode.Uri): vscode.Uri[] {
		const result: vscode.Uri[] = [];
		let cursor: vscode.Uri | undefined = descendant;

		while (cursor !== undefined) {
			const parent: vscode.Uri | undefined =
				path.dirname(cursor.fsPath) === cursor.fsPath ? undefined : vscode.Uri.file(path.dirname(cursor.fsPath));

			if (parent !== undefined && fileTreeProvider.checkedPaths.has(parent.fsPath)) {
				result.push(parent);
			}
			cursor = parent;
		}
		return result;
	}

	async function rebalanceParents(startLeaf: vscode.Uri): Promise<void> {
		let cursor: vscode.Uri | undefined = await getParent(startLeaf);

		while (cursor !== undefined) {
			const children: vscode.Uri[] = await fileTreeProvider.getChildren(cursor);

			let checkedCount: number = 0;

			for (const child of children) {
				const childPath: string = child.fsPath;
				if (fileTreeProvider.checkedPaths.has(childPath)) {
					checkedCount += 1;
				}
			}

			const parentPath: string = cursor.fsPath;
			if (checkedCount === 0) {
				fileTreeProvider.checkedPaths.delete(parentPath);
			} else if (checkedCount === children.length) {
				fileTreeProvider.checkedPaths.add(parentPath);
			} else {
				fileTreeProvider.checkedPaths.delete(parentPath);
			}

			cursor = await getParent(cursor);
		}
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
