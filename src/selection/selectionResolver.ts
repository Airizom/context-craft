import * as vscode from "vscode";
import { MAX_COLLECTED_FILES } from "../constants";
import { getIgnoreParser } from "../services/ignoreParser";
import { collectFiles } from "../services/fileCollector";
import { FileTreeProvider } from "../tree/FileTreeProvider";

export async function resolveSelectedFiles(
	fileTree: FileTreeProvider,
	_root?: vscode.Uri,
	signal?: AbortSignal
): Promise<string[]> {
	const selections = Array.from(fileTree.checkedPaths);
	console.log(`[ContextCraft] resolveSelectedFiles selections=${selections.length}`);
	const byRoot = new Map<string, { root: vscode.Uri; uris: vscode.Uri[] }>();
	for (const sel of selections) {
		const uri = vscode.Uri.file(sel);
		const ws = vscode.workspace.getWorkspaceFolder(uri);
		if (!ws) {
			continue;
		}
		const key = ws.uri.fsPath;
		if (!byRoot.has(key)) {
			byRoot.set(key, { root: ws.uri, uris: [] });
		}
		byRoot.get(key)!.uris.push(uri);
	}

	console.log(`[ContextCraft] resolveSelectedFiles roots=${byRoot.size}`);
	for (const [key, group] of byRoot) {
		console.log(`[ContextCraft]  root=${key} selections=${group.uris.length}`);
	}

	const nestedPerRoot: string[][] = await Promise.all(
		Array.from(byRoot.values()).map(async (group) => {
			const ignoreParser = await getIgnoreParser(group.root);
			const capCounter = { count: 0 };
			const nestedArrays = await Promise.all(
				group.uris.map(async (uri) => {
					try {
						const tSel0 = Date.now();
						const filesForSel = await collectFiles(
							uri,
							ignoreParser,
							group.root,
							signal,
							MAX_COLLECTED_FILES,
							capCounter
						);
						const tSel1 = Date.now();
						console.log(`[ContextCraft]  collected ${filesForSel.length} files from ${uri.fsPath} in ${tSel1 - tSel0}ms`);
						return filesForSel;
					} catch (error) {
						console.error("[ContextCraft] collectFiles failed for selection", uri.fsPath, error);
						return [] as string[];
					}
				})
			);
			if (capCounter.count >= MAX_COLLECTED_FILES) {
				console.warn(`[ContextCraft] traversal capped at ${MAX_COLLECTED_FILES} files for root ${group.root.fsPath}`);
			}
			return nestedArrays.flat();
		})
	);

	const files = nestedPerRoot.flat();
	return Array.from(new Set(files));
}

export function pruneSelectionsOutsideWorkspace(fileTreeProvider: FileTreeProvider): boolean {
	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	if (workspaceFolders.length === 0) {
		if (fileTreeProvider.checkedPaths.size === 0) {
			return false;
		}
		fileTreeProvider.checkedPaths.clear();
		return true;
	}
	let changed = false;
	for (const fsPath of Array.from(fileTreeProvider.checkedPaths)) {
		const folder = vscode.workspace.getWorkspaceFolder(vscode.Uri.file(fsPath));
		if (!folder) {
			fileTreeProvider.checkedPaths.delete(fsPath);
			changed = true;
		}
	}
	return changed;
}
