import * as vscode from "vscode";
import { FileTreeProvider } from "../FileTreeProvider";
import { STATE_KEY_SELECTED } from "../constants";

export async function updateSelectedPaths(
	context: vscode.ExtensionContext,
	fileTreeProvider: FileTreeProvider
): Promise<void> {
	await context.workspaceState.update(
		STATE_KEY_SELECTED,
		Array.from(fileTreeProvider.checkedPaths)
	);
}

