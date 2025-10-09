import * as vscode from "vscode";
import * as path from "path";

export function registerCopyRelativePathCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.copyRelativePath",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
			if (!workspaceFolder) {
				// If not in workspace, just copy the full path
				await vscode.env.clipboard.writeText(uri.fsPath);
				return;
			}
			const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
			await vscode.env.clipboard.writeText(relativePath);
		}
	);
	context.subscriptions.push(disposable);
}
