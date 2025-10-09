import * as vscode from "vscode";

export function registerOpenInTerminalCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.openInTerminal",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			await vscode.commands.executeCommand("openInIntegratedTerminal", uri);
		}
	);
	context.subscriptions.push(disposable);
}
