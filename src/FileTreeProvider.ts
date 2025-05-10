import * as vscode from "vscode";
import * as path from "path";

export class FileTreeProvider implements vscode.TreeDataProvider<vscode.Uri> {
	public readonly checkedPaths: Set<string>;
	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
	public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
	public readonly kindCache = new Map<string, vscode.FileType>();

	public constructor(initialChecked: Set<string>) {
		this.checkedPaths = initialChecked;
		const watcher = vscode.workspace.createFileSystemWatcher("**/*");
		watcher.onDidCreate((uri) => this.refresh(uri));
		watcher.onDidDelete((uri) => this.refresh(uri));
		watcher.onDidChange((uri) => this.refresh(uri));
	}

	public async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
		if (!element) {
			const roots = vscode.workspace.workspaceFolders ?? [];
			const childUris: vscode.Uri[] = [];
			for (const ws of roots) {
				const entries = await vscode.workspace.fs.readDirectory(ws.uri);
				for (const [name, type] of entries) {
					const candidate = vscode.Uri.joinPath(ws.uri, name);
					if (!(await this.isIgnored(candidate))) {
						this.kindCache.set(candidate.fsPath, type);
						childUris.push(candidate);
					}
				}
			}
			return this.sortUris(childUris);
		}
		const children = await vscode.workspace.fs.readDirectory(element);
		const visible: vscode.Uri[] = [];
		for (const [name, type] of children) {
			const candidate = vscode.Uri.joinPath(element, name);
			if (!(await this.isIgnored(candidate))) {
				this.kindCache.set(candidate.fsPath, type);
				visible.push(candidate);
			}
		}
		return this.sortUris(visible);
	}

	private async isIgnored(uri: vscode.Uri): Promise<boolean> {
		return false;
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
		const parentPath = path.dirname(element.fsPath);
		for (const ws of vscode.workspace.workspaceFolders ?? []) {
			if (parentPath === ws.uri.fsPath) {
				return undefined;
			}
		}
		return vscode.Uri.file(parentPath);
	}

	public refresh(uri?: vscode.Uri): void {
		this.onDidChangeTreeDataEmitter.fire(uri);
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
