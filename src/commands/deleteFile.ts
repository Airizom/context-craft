import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "../tree/FileTreeProvider";
import { ensureTrailingSep, isWorkspaceRoot } from "./fileUtils";
import { updateSelectedPaths } from "./commandUtils";

export function registerDeleteFileCommand(
	context: vscode.ExtensionContext,
	fileTreeProvider: FileTreeProvider,
	debouncedRefreshAndUpdate: () => void
): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.deleteFile",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			if (isWorkspaceRoot(uri)) {
				vscode.window.showWarningMessage(
					"Deleting workspace roots is not supported. Remove the folder from the workspace instead."
				);
				return;
			}
			const fileName = path.basename(uri.fsPath);
			const answer = await vscode.window.showWarningMessage(
				`Are you sure you want to delete '${fileName}'?`,
				{ modal: true },
				"Move to Trash"
			);

			if (answer === "Move to Trash") {
				try {
					await vscode.workspace.fs.delete(uri, {
						recursive: true,
						useTrash: true
					});
					const selectionChanged = removeDeletedSelections(fileTreeProvider, uri.fsPath);
					if (selectionChanged) {
						await updateSelectedPaths(context, fileTreeProvider);
						debouncedRefreshAndUpdate();
					}
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					vscode.window.showErrorMessage(
						`Failed to move '${fileName}' to Trash: ${message}`
					);
				}
			}
		}
	);
	context.subscriptions.push(disposable);
}

function removeDeletedSelections(fileTreeProvider: FileTreeProvider, deletedFsPath: string): boolean {
	let changed = false;
	const deletedPrefix = ensureTrailingSep(deletedFsPath);
	for (const checked of Array.from(fileTreeProvider.checkedPaths)) {
		if (checked === deletedFsPath || checked.startsWith(deletedPrefix)) {
			fileTreeProvider.checkedPaths.delete(checked);
			changed = true;
		}
	}
	return changed;
}
