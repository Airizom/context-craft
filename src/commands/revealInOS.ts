import * as vscode from "vscode";

export function registerRevealInOSCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.revealInOS",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			await vscode.commands.executeCommand("revealFileInOS", uri);
		}
	);
	context.subscriptions.push(disposable);
}
