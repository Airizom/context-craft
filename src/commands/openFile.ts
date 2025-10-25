import * as vscode from "vscode";

export function registerOpenFileCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.openFile",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			await vscode.window.showTextDocument(uri, {
				preview: false
			});
		}
	);
	context.subscriptions.push(disposable);
}
