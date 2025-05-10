import * as vscode from "vscode";
import * as path from "path";

export class FileTreeProvider implements vscode.TreeDataProvider<vscode.Uri> {
	public readonly checkedPaths: Set<string>;
	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.Uri | undefined>();
	public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

	public readonly kindCache = new Map<string, vscode.FileType>();

	public constructor(initialChecked: Set<string>) {
		this.checkedPaths = initialChecked;

		/* auto-refresh on FS changes */
		const watcher = vscode.workspace.createFileSystemWatcher("**/*");
		watcher.onDidCreate((uri) => this.refresh(uri));
		watcher.onDidDelete((uri) => this.refresh(uri));
		watcher.onDidChange((uri) => this.refresh(uri));
	}

	/* ---------- data ---------- */

	public async getChildren(element?: vscode.Uri): Promise<vscode.Uri[]> {
		if (!element) {
			const workspaces = vscode.workspace.workspaceFolders ?? [];
			return workspaces.map((folder) => folder.uri);
		}

		const children = await vscode.workspace.fs.readDirectory(element);
		const uris = children.map(([name]) => vscode.Uri.joinPath(element, name));

		/* folders first, then files, both alpha-sort */
		return uris.sort((a, b) => {
			const aIsDir = this.isDirectorySync(a);
			const bIsDir = this.isDirectorySync(b);
			if (aIsDir && !bIsDir) { return -1; }
			if (!aIsDir && bIsDir) { return 1; }
			return a.fsPath.localeCompare(b.fsPath);
		});
	}

	public async getTreeItem(element: vscode.Uri): Promise<vscode.TreeItem> {
		const isDir = await this.isDirectory(element);

		const treeItem = new vscode.TreeItem(
			element,
			isDir ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None
		);

		treeItem.label = path.basename(element.fsPath);
		treeItem.resourceUri = element;
		treeItem.contextValue = isDir ? "folder" : "file";
		treeItem.checkboxState = this.checkedPaths.has(element.fsPath)
			? vscode.TreeItemCheckboxState.Checked
			: vscode.TreeItemCheckboxState.Unchecked;

		if (!isDir) {
			treeItem.command = {
				title: "Open File",
				command: "vscode.open",
				arguments: [element]
			};
		}

		return treeItem;
	}

	public getParent(element: vscode.Uri): vscode.ProviderResult<vscode.Uri> {
		const parentPath = path.dirname(element.fsPath);
		if (parentPath === element.fsPath) {
			return undefined;
		}
		return vscode.Uri.file(parentPath);
	}

	public refresh(uri?: vscode.Uri): void {
		this.onDidChangeTreeDataEmitter.fire(uri);
	}

	/* ---------- helpers ---------- */

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
