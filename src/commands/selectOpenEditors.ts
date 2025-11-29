import * as vscode from "vscode";
import { FileTreeProvider } from "../FileTreeProvider";
import { updateSelectedPaths } from "./commandUtils";

export function registerSelectOpenEditorsCommand(
	context: vscode.ExtensionContext,
	fileTreeProvider: FileTreeProvider,
	debouncedRefreshAndUpdate: () => void
): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.selectOpenEditors",
		async () => {
			const candidateUris = new Map<string, vscode.Uri>();

			for (const tabGroup of vscode.window.tabGroups.all) {
				for (const tab of tabGroup.tabs) {
					const input = tab.input;
					if (input instanceof vscode.TabInputText) {
						candidateUris.set(input.uri.fsPath, input.uri);
					}
				}
			}

			if (candidateUris.size === 0) {
				vscode.window.showInformationMessage("No open editors found");
				return;
			}

			const { selectablePaths, outOfWorkspaceCount } = filterSelectableUris(candidateUris);

			if (selectablePaths.size === 0) {
				const suffix = outOfWorkspaceCount > 0
					? ` (${outOfWorkspaceCount} outside current workspace)`
					: "";
				vscode.window.showInformationMessage(`No selectable open editors found${suffix}`);
				return;
			}

			fileTreeProvider.checkedPaths.clear();
			for (const filePath of selectablePaths) {
				fileTreeProvider.checkedPaths.add(filePath);
			}

			await updateSelectedPaths(context, fileTreeProvider);

			debouncedRefreshAndUpdate();

			const skippedSuffix = outOfWorkspaceCount > 0
				? ` (skipped ${outOfWorkspaceCount} outside workspace)`
				: "";
			vscode.window.showInformationMessage(
				`Selected ${selectablePaths.size} open editor${selectablePaths.size === 1 ? "" : "s"}${skippedSuffix}`
			);
		}
	);
	context.subscriptions.push(disposable);
}

function filterSelectableUris(
	candidateUris: Map<string, vscode.Uri>
): { selectablePaths: Set<string>; outOfWorkspaceCount: number } {
	const selectablePaths = new Set<string>();
	let outOfWorkspaceCount = 0;

	for (const [fsPath, uri] of candidateUris) {
		if (!isInWorkspace(uri)) {
			outOfWorkspaceCount++;
			continue;
		}
		selectablePaths.add(fsPath);
	}

	return { selectablePaths, outOfWorkspaceCount };
}

function isInWorkspace(uri: vscode.Uri): boolean {
	return vscode.workspace.getWorkspaceFolder(uri) !== undefined;
}

