import * as vscode from "vscode";
import * as path from "path";

export function ensureTrailingSep(fsPath: string): string {
	return fsPath.endsWith(path.sep) ? fsPath : `${fsPath}${path.sep}`;
}

export function isWorkspaceRoot(uri: vscode.Uri): boolean {
	return (vscode.workspace.workspaceFolders ?? []).some(
		folder => folder.uri.fsPath === uri.fsPath
	);
}

