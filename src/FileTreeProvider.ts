import * as vscode from "vscode";
import * as path from "path";

export class FileTreeProvider implements vscode.TreeDataProvider<vscode.Uri> {
	public readonly checkedPaths: Set<string>;
	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
	public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
	public readonly kindCache = new Map<string, vscode.FileType>();
	public readonly childrenCache = new Map<string, vscode.Uri[]>();
	private readonly debouncedRefreshAndUpdate: () => void;

	public constructor(initialChecked: Set<string>, context: vscode.ExtensionContext, debouncedRefreshAndUpdate: () => void) {
		this.checkedPaths = initialChecked;
		this.debouncedRefreshAndUpdate = debouncedRefreshAndUpdate;
		const watcher = vscode.workspace.createFileSystemWatcher(
			"**/*",
			false,
			false,
			false
		);
		watcher.onDidCreate((uri) => {
			if (this.shouldIgnoreWatcherEvent(uri)) { return; }
			this.kindCache.delete(uri.fsPath);
			this.kindCache.delete(path.dirname(uri.fsPath));
			this.childrenCache.delete(uri.fsPath);
			this.childrenCache.delete(path.dirname(uri.fsPath));
			this.debouncedRefreshAndUpdate();
		});
		watcher.onDidDelete((uri) => {
			if (this.shouldIgnoreWatcherEvent(uri)) { return; }
			this.kindCache.delete(uri.fsPath);
			this.kindCache.delete(path.dirname(uri.fsPath));
			this.childrenCache.delete(uri.fsPath);
			this.childrenCache.delete(path.dirname(uri.fsPath));
			this.debouncedRefreshAndUpdate();
		});
		watcher.onDidChange((uri) => {
			if (this.shouldIgnoreWatcherEvent(uri)) { return; }
			this.kindCache.delete(uri.fsPath);
			this.childrenCache.delete(path.dirname(uri.fsPath));
			this.debouncedRefreshAndUpdate();
		});
		context.subscriptions.push(watcher);
	}

	public async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
		if (!element) {
			const roots = vscode.workspace.workspaceFolders ?? [];
			// For multi-root workspaces, show workspace folders as top-level items
			if (roots.length > 1) {
				// Cache workspace folders as directories
				for (const ws of roots) {
					this.kindCache.set(ws.uri.fsPath, vscode.FileType.Directory);
				}
				return roots.map(ws => ws.uri);
			}
			// For single-root, show the contents directly
			const childUris: vscode.Uri[] = [];
			for (const ws of roots) {
				const entries = await vscode.workspace.fs.readDirectory(ws.uri);
				for (const [name, type] of entries) {
					const candidate = vscode.Uri.joinPath(ws.uri, name);
					if (!this.isIgnored(candidate)) {
						this.kindCache.set(candidate.fsPath, type);
						childUris.push(candidate);
					}
				}
			}
			return this.sortUris(childUris);
		}
		const cacheKey = element.fsPath;
		const cachedChildren = this.childrenCache.get(cacheKey);
		if (cachedChildren !== undefined) {
			return cachedChildren;
		}

		const children = await vscode.workspace.fs.readDirectory(element);
		const visible = [] as vscode.Uri[];
		for (const [name, type] of children) {
			const candidate = vscode.Uri.joinPath(element, name);
			if (!this.isIgnored(candidate)) {
				this.kindCache.set(candidate.fsPath, type);
				visible.push(candidate);
			}
		}
		const sorted = this.sortUris(visible);
		this.childrenCache.set(cacheKey, sorted);
		return sorted;
	}

	private isIgnored(uri: vscode.Uri): boolean {
		return false;
	}

	private shouldIgnoreWatcherEvent(uri: vscode.Uri): boolean {
		const pathSegments = uri.fsPath.split(path.sep);
		const ignoredDirs = new Set(['.git', 'node_modules', '.vscode', 'dist', 'build', 'out', 'target', '.next', '.nuxt']);
		return pathSegments.some(segment => ignoredDirs.has(segment));
	}

	private sortUris(uris: vscode.Uri[]): vscode.Uri[] {
		return uris.sort((a, b) => {
			const aIsDir = this.isDirectorySync(a);
			const bIsDir = this.isDirectorySync(b);
			if (aIsDir && !bIsDir) {
				return -1;
			}
			if (!aIsDir && bIsDir) {
				return 1;
			}
			return a.fsPath.localeCompare(b.fsPath);
		});
	}

	public async getTreeItem(element: vscode.Uri): Promise<vscode.TreeItem> {
		const isDirectory: boolean = await this.isDirectory(element);
		const treeItem: vscode.TreeItem = new vscode.TreeItem(
			element,
			isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);

		treeItem.label = path.basename(element.fsPath);
		treeItem.resourceUri = element;
		treeItem.contextValue = isDirectory ? "folder" : "file";

		treeItem.checkboxState = this.computeCheckboxState(element);

		if (!isDirectory) {
			treeItem.command = {
				title: "Open File",
				command: "vscode.open",
				arguments: [element]
			};
		}
		return treeItem;
	}

	private computeCheckboxState(
		element: vscode.Uri
	): vscode.TreeItemCheckboxState {
		if (this.checkedPaths.has(element.fsPath)) {
			return vscode.TreeItemCheckboxState.Checked;
		}

		let parentPath: string = path.dirname(element.fsPath);
		while (parentPath !== element.fsPath) {
			if (this.checkedPaths.has(parentPath)) {
				return vscode.TreeItemCheckboxState.Checked;
			}
			const next: string = path.dirname(parentPath);
			if (next === parentPath) {
				break;
			}
			parentPath = next;
		}
		return vscode.TreeItemCheckboxState.Unchecked;
	}

	public getParent(element: vscode.Uri): vscode.ProviderResult<vscode.Uri> {
		const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
		// If element is a workspace root in multi-root mode, it has no parent
		if (workspaceFolders.length > 1) {
			for (const ws of workspaceFolders) {
				if (element.fsPath === ws.uri.fsPath) {
					return undefined;
				}
			}
		}
		const parentPath = path.dirname(element.fsPath);
		// Check if parent is the workspace root
		for (const ws of workspaceFolders) {
			if (parentPath === ws.uri.fsPath) {
				// In multi-root, return the workspace folder as parent
				// In single-root, return undefined (no parent)
				return workspaceFolders.length > 1 ? ws.uri : undefined;
			}
		}
		return vscode.Uri.file(parentPath);
	}

	public refresh(uri?: vscode.Uri): void {
		this.onDidChangeTreeDataEmitter.fire(uri);
	}

	public refreshMany(uris: vscode.Uri[]): void {
		const seen = new Set<string>();
		for (const uri of uris) {
			if (!uri) { continue; }
			const key = uri.fsPath;
			if (seen.has(key)) { continue; }
			seen.add(key);
			this.onDidChangeTreeDataEmitter.fire(uri);
		}
	}

	private async isDirectory(uri: vscode.Uri): Promise<boolean> {
		if (!this.kindCache.has(uri.fsPath)) {
			try {
				const stat = await vscode.workspace.fs.stat(uri);
				this.kindCache.set(uri.fsPath, stat.type);
			} catch {
				this.kindCache.set(uri.fsPath, vscode.FileType.Unknown);
			}
		}
		return this.kindCache.get(uri.fsPath) === vscode.FileType.Directory;
	}

	private isDirectorySync(uri: vscode.Uri): boolean {
		const cached = this.kindCache.get(uri.fsPath);
		return cached === vscode.FileType.Directory;
	}
}
