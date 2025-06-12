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
                const nestedArrays = await Promise.all(
                        children.map(async ([name]) => {
                                const childUri = vscode.Uri.joinPath(uri, name);
                                return collectFiles(childUri, ignoreParser, root);
                        })
                );
                return nestedArrays.flat();
	}
	return ignoreParser.ignores(rel) ? [] : [uri.fsPath];
}

interface BinaryCacheEntry {
	isBinary: boolean;
	mtime: number;
}

const MAX_BINARY_CACHE_SIZE = 5000;
const isBinaryCache = new Map<string, BinaryCacheEntry>();

function evictOldestBinaryCacheEntries() {
	if (isBinaryCache.size > MAX_BINARY_CACHE_SIZE) {
		const entries = Array.from(isBinaryCache.entries());
		const toDelete = entries.slice(0, isBinaryCache.size - MAX_BINARY_CACHE_SIZE);
		for (const [key] of toDelete) {
			isBinaryCache.delete(key);
		}
	}
}

export async function isBinary(absPath: string): Promise<boolean> {
	let stats: vscode.FileStat | undefined;
	
	try {
		stats = await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
		const cached = isBinaryCache.get(absPath);
		if (cached && cached.mtime === stats.mtime) {
			return cached.isBinary;
		}
	} catch {
		// If we can't stat the file, fall through to the binary check
	}
	
	try {
		let result: boolean;
		if ('readFileStream' in vscode.workspace.fs && typeof (vscode.workspace.fs as any).readFileStream === 'function') {
			const stream = await (vscode.workspace.fs as any).readFileStream(vscode.Uri.file(absPath));
			const reader = stream.getReader();
			let total = 0;
			result = false;
			while (total < 512) {
				const { value, done } = await reader.read();
				if (done || !value) { break; }
				for (let i = 0; i < value.length && total < 512; i++, total++) {
					if (value[i] === 0) {
						result = true;
						break;
					}
				}
				if (result) { break; }
			}
			reader.releaseLock();
			stream.cancel();
		} else {
			const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
			result = bytes.subarray(0, 512).some(b => b === 0);
		}
		
		if (stats) {
			isBinaryCache.set(absPath, { isBinary: result, mtime: stats.mtime });
			evictOldestBinaryCacheEntries();
		}
		return result;
	} catch {
		if (stats) {
			isBinaryCache.set(absPath, { isBinary: true, mtime: stats.mtime });
			evictOldestBinaryCacheEntries();
		}
		return true;
	}
}


