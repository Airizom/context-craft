import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";
import * as os from "os";
import ignore from "ignore";

const STATE_KEY_SELECTED = "contextCraft.selectedPaths";

let ignoreParserCache: Map<string, { parser: ReturnType<typeof ignore>, mtime: number }> = new Map();

async function getIgnoreParser(workspaceRootUri: vscode.Uri): Promise<ReturnType<typeof ignore>> {
	const gitIgnoreUri = vscode.Uri.joinPath(workspaceRootUri, ".gitignore");
	try {
		const stat = await vscode.workspace.fs.stat(gitIgnoreUri);
		const cacheKey = workspaceRootUri.fsPath;
		const cached = ignoreParserCache.get(cacheKey);
		if (cached && cached.mtime === stat.mtime) {
			return cached.parser;
		}
		const gitIgnoreBytes = await vscode.workspace.fs.readFile(gitIgnoreUri);
		let gitIgnoreContent: string;
		if (typeof TextDecoder !== "undefined") {
			const decoder = new TextDecoder("utf-8");
			gitIgnoreContent = decoder.decode(gitIgnoreBytes);
		} else {
			gitIgnoreContent = Buffer.from(gitIgnoreBytes).toString("utf-8");
		}
		const parser = ignore().add(gitIgnoreContent);
		ignoreParserCache.set(cacheKey, { parser, mtime: stat.mtime });
		return parser;
	} catch {
		return ignore();
	}
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	/* ---------- provider & view ---------- */
	const persisted: string[] =
		context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	const fileTreeProvider = new FileTreeProvider(new Set(persisted));

	const treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});

	context.subscriptions.push(
		vscode.commands.registerCommand("contextCraft.unselectAll", async () => {
			fileTreeProvider.checkedPaths.clear();
			await context.workspaceState.update(STATE_KEY_SELECTED, []);
			fileTreeProvider.refresh();
		})
	);

	context.subscriptions.push(
		vscode.commands.registerCommand("contextCraft.copySelected", async () => {
			const workspaceFolders = vscode.workspace.workspaceFolders;
			if (!workspaceFolders || workspaceFolders.length === 0) {
				vscode.window.showWarningMessage(
					"No workspace folder open. Cannot copy selected files."
				);
				return;
			}
			if (workspaceFolders.length > 1) {
				vscode.window.showWarningMessage(
					"Multi-root workspaces are not fully supported. Only the first root will be used."
				);
			}
			const workspaceRootUri = workspaceFolders[0].uri;
			const ignoreParser = await getIgnoreParser(workspaceRootUri);
			const absoluteSelected = Array.from(fileTreeProvider.checkedPaths);
			let absoluteFiles: string[] = [];
			for (const abs of absoluteSelected) {
				const sub = await collectFiles(vscode.Uri.file(abs), ignoreParser, workspaceRootUri);
				absoluteFiles.push(...sub);
			}
			absoluteFiles = Array.from(new Set(absoluteFiles)).sort();
			if (absoluteFiles.length === 0) {
				vscode.window.showInformationMessage("No non-ignored files resolved.");
				return;
			}
			let xmlChunks: string[] = ["<code_files>"];
			for (const abs of absoluteFiles) {
				const rel = path.relative(workspaceRootUri.fsPath, abs);
				const fileName = path.basename(rel);
				const xmlPath  = rel.split(path.sep).join("/");
				if (await isBinary(abs)) {
					xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" binary="true"/>`);
					continue;
				}
				const bytes   = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
				if (bytes.byteLength > 200_000) {
					xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" truncated="true"/>`);
					continue;
				}
				const content = Buffer.from(bytes).toString("utf-8");
				const safe    = content.replaceAll("]]>" , "]]]]><![CDATA[>");
				xmlChunks.push(
					`  <file name="${fileName}" path="${xmlPath}"><![CDATA[`,
					safe,
					`]]></file>`
				);
			}
			xmlChunks.push("</code_files>");
			const xmlPayload = xmlChunks.join(os.EOL);
			await vscode.env.clipboard.writeText(xmlPayload);
			vscode.window.showInformationMessage(`Copied ${absoluteFiles.length} file node(s).`);
		})
	);

	/* ---------- checkbox cascade ---------- */
	treeView.onDidChangeCheckboxState(async (event) => {
		for (const [clickedResourceUri, newState] of event.items) {
			await toggleSelection(clickedResourceUri, newState === vscode.TreeItemCheckboxState.Checked);
		}
		fileTreeProvider.refresh();
		void context.workspaceState.update(
			STATE_KEY_SELECTED,
			Array.from(fileTreeProvider.checkedPaths)
		);
	});

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(
			(activeTextEditor) => {
				if (activeTextEditor !== undefined) {
					const documentUri: vscode.Uri = activeTextEditor.document.uri;
					treeView.reveal(
						documentUri,
						{
							select: true,
							focus: false,
							expand: true
						}
					).then(
						() => {},
						(error) => {
							console.error("Could not reveal in tree:", error);
						}
					);
				}
			}
		)
	);

	async function toggleSelection(target: vscode.Uri, isChecked: boolean): Promise<void> {
		const targetPath: string = target.fsPath;
		const startsWithSep: string = targetPath + path.sep;

		if (isChecked) {
			fileTreeProvider.checkedPaths.add(targetPath);

			for (const pathInSet of Array.from(fileTreeProvider.checkedPaths)) {
				if (pathInSet !== targetPath && pathInSet.startsWith(startsWithSep)) {
					fileTreeProvider.checkedPaths.delete(pathInSet);
				}
			}
		} else {
			fileTreeProvider.checkedPaths.delete(targetPath);
			for (const pathInSet of Array.from(fileTreeProvider.checkedPaths)) {
				if (pathInSet.startsWith(startsWithSep)) {
					fileTreeProvider.checkedPaths.delete(pathInSet);
				}
			}
			const selectedAncestors: vscode.Uri[] = findAllSelectedAncestors(target);
			for (const ancestor of selectedAncestors) {
				fileTreeProvider.checkedPaths.delete(ancestor.fsPath);
			}
			if (selectedAncestors.length > 0) {
				const topMost: vscode.Uri = selectedAncestors[selectedAncestors.length - 1];
				await reselectSiblingsExcept(topMost, targetPath);
			}
		}

		await rebalanceParents(target);
	}

	async function reselectSiblingsExcept(parent: vscode.Uri, excludedPath: string): Promise<void> {
		const directChildren: vscode.Uri[] = await fileTreeProvider.getChildren(parent);

		for (const child of directChildren) {
			const childPath: string = child.fsPath;

			if (childPath === excludedPath) {
				continue;
			}
			if (excludedPath.startsWith(childPath + path.sep)) {
				continue;
			}
			fileTreeProvider.checkedPaths.add(childPath);
		}
	}

	function findAllSelectedAncestors(descendant: vscode.Uri): vscode.Uri[] {
		const result: vscode.Uri[] = [];
		let cursor: vscode.Uri | undefined = descendant;

		while (cursor !== undefined) {
			const parent: vscode.Uri | undefined =
				path.dirname(cursor.fsPath) === cursor.fsPath ? undefined : vscode.Uri.file(path.dirname(cursor.fsPath));

			if (parent !== undefined && fileTreeProvider.checkedPaths.has(parent.fsPath)) {
				result.push(parent);
			}
			cursor = parent;
		}
		return result;
	}

	async function rebalanceParents(startLeaf: vscode.Uri): Promise<void> {
		let cursor: vscode.Uri | undefined = await getParent(startLeaf);

		while (cursor !== undefined) {
			const children: vscode.Uri[] = await fileTreeProvider.getChildren(cursor);

			let checkedCount: number = 0;

			for (const child of children) {
				const childPath: string = child.fsPath;
				if (fileTreeProvider.checkedPaths.has(childPath)) {
					checkedCount += 1;
				}
			}

			const parentPath: string = cursor.fsPath;
			if (checkedCount === 0) {
				fileTreeProvider.checkedPaths.delete(parentPath);
			} else if (checkedCount === children.length) {
				fileTreeProvider.checkedPaths.add(parentPath);
			} else {
				fileTreeProvider.checkedPaths.delete(parentPath);
			}

			cursor = await getParent(cursor);
		}
	}
}

/* ---------- helpers ---------- */

async function getParent(resourceUri: vscode.Uri): Promise<vscode.Uri | undefined> {
	const parentPath: string = path.dirname(resourceUri.fsPath);
	if (parentPath === resourceUri.fsPath) {
		return undefined;
	}
	return vscode.Uri.file(parentPath);
}

async function collectFiles(
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

async function isBinary(absPath: string): Promise<boolean> {
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

/* istanbul ignore next */
export function deactivate(): void {
	/* noop */
}
