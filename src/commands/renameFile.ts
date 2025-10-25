import * as vscode from "vscode";
import * as path from "path";

export function registerRenameFileCommand(context: vscode.ExtensionContext): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.renameFile",
		async (uri: vscode.Uri) => {
			if (!uri) {
				return;
			}
			const currentName = path.basename(uri.fsPath);
			const newName = await vscode.window.showInputBox({
				prompt: "Enter new name",
				value: currentName,
				valueSelection: [0, currentName.lastIndexOf(".") !== -1 ? currentName.lastIndexOf(".") : currentName.length]
			});

			if (!newName || newName === currentName) {
				return;
			}

			const newUri = vscode.Uri.file(path.join(path.dirname(uri.fsPath), newName));
			const edit = new vscode.WorkspaceEdit();
			edit.renameFile(uri, newUri);
			await vscode.workspace.applyEdit(edit);
		}
	);
	context.subscriptions.push(disposable);
}
