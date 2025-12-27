import * as path from "path";
import * as vscode from "vscode";

export async function getParent(resourceUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const parentPath: string = path.dirname(resourceUri.fsPath);
	if (parentPath === resourceUri.fsPath) {
		return undefined;
	}
	return vscode.Uri.file(parentPath);
}
