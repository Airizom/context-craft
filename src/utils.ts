import * as vscode from "vscode";
import * as path from "path";
import ignore from "ignore";

export async function getParent(resourceUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const parentPath: string = path.dirname(resourceUri.fsPath);
	if (parentPath === resourceUri.fsPath) {
		return undefined;
	}
	return vscode.Uri.file(parentPath);
}

export async function collectFiles(
	uri: vscode.Uri,
	ignoreParser: ReturnType<typeof ignore>,
	root: vscode.Uri
): Promise<string[]> {
	const rel = path.relative(root.fsPath, uri.fsPath).split(path.sep).join("/");
	const stat = await vscode.workspace.fs.stat(uri);
	if (stat.type === vscode.FileType.Directory) {
		if (ignoreParser.ignores(rel + "/")) { return []; }
		const children = await vscode.workspace.fs.readDirectory(uri);
		const nested: string[] = [];
		for (const [name] of children) {
			const childUri = vscode.Uri.joinPath(uri, name);
			nested.push(...await collectFiles(childUri, ignoreParser, root));
		}
		return nested;
	}
	return ignoreParser.ignores(rel) ? [] : [uri.fsPath];
}

export async function isBinary(absPath: string): Promise<boolean> {
	try {
		if ('readFileStream' in vscode.workspace.fs && typeof (vscode.workspace.fs as any).readFileStream === 'function') {
			const stream = await (vscode.workspace.fs as any).readFileStream(vscode.Uri.file(absPath));
			const reader = stream.getReader();
			let total = 0;
			while (total < 512) {
				const { value, done } = await reader.read();
				if (done || !value) { break; }
				for (let i = 0; i < value.length && total < 512; i++, total++) {
					if (value[i] === 0) {
						reader.releaseLock();
						stream.cancel();
						return true;
					}
				}
			}
			reader.releaseLock();
			stream.cancel();
			return false;
		} else {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
			return bytes.subarray(0, 512).some(b => b === 0);
		}
	} catch {
		return true;
	}
} 