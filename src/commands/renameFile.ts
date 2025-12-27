import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "../tree/FileTreeProvider";
import { ensureTrailingSep, isWorkspaceRoot } from "./fileUtils";
import { updateSelectedPaths } from "./commandUtils";

export function registerRenameFileCommand(
	context: vscode.ExtensionContext,
	fileTreeProvider: FileTreeProvider,
	debouncedRefreshAndUpdate: () => void
): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.renameFile",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			if (isWorkspaceRoot(uri)) {
				vscode.window.showWarningMessage(
					"Renaming workspace roots is not supported. Update your workspace folders instead."
				);
				return;
			}
			const currentName = path.basename(uri.fsPath);
			const newName = await vscode.window.showInputBox({
				prompt: "Enter new name",
				value: currentName,
				valueSelection: [0, currentName.lastIndexOf(".") !== -1 ? currentName.lastIndexOf(".") : currentName.length]
			});

			if (!newName || newName === currentName) {
				return;
			}

			const newUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), newName));
			const edit = new vscode.WorkspaceEdit();
			edit.renameFile(uri, newUri);
			const applied = await vscode.workspace.applyEdit(edit);
			if (!applied) {
				vscode.window.showErrorMessage(`Could not rename '${currentName}'.`);
				return;
			}

			const selectionChanged = updateSelectionsForRename(
				fileTreeProvider,
				uri.fsPath,
				newUri.fsPath
			);
			if (selectionChanged) {
				await updateSelectedPaths(context, fileTreeProvider);
				debouncedRefreshAndUpdate();
			}
		}
	);
	context.subscriptions.push(disposable);
}

function updateSelectionsForRename(
	fileTreeProvider: FileTreeProvider,
	oldFsPath: string,
	newFsPath: string
): boolean {
	const updatedPaths = new Set<string>();
	let changed = false;
	const oldPrefix = ensureTrailingSep(oldFsPath);
	for (const checked of fileTreeProvider.checkedPaths) {
		if (checked === oldFsPath) {
			if (checked !== newFsPath) {
				changed = true;
			}
			updatedPaths.add(newFsPath);
			continue;
		}
		if (checked.startsWith(oldPrefix)) {
			changed = true;
			updatedPaths.add(newFsPath + checked.slice(oldFsPath.length));
			continue;
		}
		updatedPaths.add(checked);
	}
	if (!changed) {
		return false;
	}
	fileTreeProvider.checkedPaths.clear();
	for (const entry of updatedPaths) {
		fileTreeProvider.checkedPaths.add(entry);
	}
	return true;
}
