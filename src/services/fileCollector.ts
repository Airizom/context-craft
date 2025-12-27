import * as path from "path";
import * as vscode from "vscode";
import ignore from "ignore";
import { createLimit } from "../utils/asyncLimit";

const fsLimit = createLimit(24);

export async function collectFiles(
	uri: vscode.Uri,
	ignoreParser: ReturnType<typeof ignore>,
	root: vscode.Uri,
	signal?: AbortSignal,
	maxFiles?: number,
	counter?: { count: number }
): Promise<string[]> {
	if (signal?.aborted) {
		return [];
	}
	const rel = path.relative(root.fsPath, uri.fsPath).split(path.sep).join("/");
	const stat = await fsLimit(async () => vscode.workspace.fs.stat(uri));
	if (stat.type === vscode.FileType.Directory) {
		const relDir = rel === "" ? undefined : `${rel}/`;
		if (relDir && ignoreParser.ignores(relDir)) {
			return [];
		}
		if (signal?.aborted) {
			return [];
		}
		const children = await fsLimit(async () => vscode.workspace.fs.readDirectory(uri));
		const out: string[] = [];
		for (const [name] of children) {
			if (signal?.aborted) {
				break;
			}
			if (maxFiles !== undefined && counter && counter.count >= maxFiles) {
				// Soft stop when hitting cap; log once per traversal
				if (counter.count === maxFiles) {
					console.warn(`[ContextCraft] collectFiles hit cap maxFiles=${maxFiles}; stopping traversal`);
				}
				break;
			}
			const childUri = vscode.Uri.joinPath(uri, name);
			// Recurse directly; wrapping recursion in fsLimit can deadlock once depth exceeds the concurrency cap.
			const nested = await collectFiles(childUri, ignoreParser, root, signal, maxFiles, counter);
			if (nested.length) {
				out.push(...nested);
			}
		}
		return out;
	}
	if (rel !== "" && ignoreParser.ignores(rel)) {
		return [];
	}
	if (maxFiles !== undefined && counter) {
		if (counter.count >= maxFiles) {
			return [];
		}
		counter.count++;
	}
	return [uri.fsPath];
}
