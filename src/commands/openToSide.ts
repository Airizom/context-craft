import * as vscode from "vscode";

export function registerOpenToSideCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.openToSide",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			await vscode.window.showTextDocument(uri, {
				viewColumn: vscode.ViewColumn.Beside,
				preview: false
			});
		}
	);
	context.subscriptions.push(disposable);
}
