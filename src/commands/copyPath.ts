import * as vscode from "vscode";

export function registerCopyPathCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.copyPath",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			await vscode.env.clipboard.writeText(uri.fsPath);
		}
	);
	context.subscriptions.push(disposable);
}
