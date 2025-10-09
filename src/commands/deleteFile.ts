import * as vscode from "vscode";
import * as path from "path";

export function registerDeleteFileCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.deleteFile",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			const fileName = path.basename(uri.fsPath);
			const answer = await vscode.window.showWarningMessage(
				`Are you sure you want to delete '${fileName}'?`,
				{ modal: true },
				"Move to Trash"
			);

			if (answer === "Move to Trash") {
				const edit = new vscode.WorkspaceEdit();
				edit.deleteFile(uri, { recursive: true, ignoreIfNotExists: false });
				await vscode.workspace.applyEdit(edit);
			}
		}
	);
	context.subscriptions.push(disposable);
}
