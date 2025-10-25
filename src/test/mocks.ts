import * as path from "path";
import * as fs from "fs/promises";
import type * as vscode from "vscode";

const mockFileType = {
	Unknown: 0,
	File: 1,
	Directory: 2,
	SymbolicLink: 64
} as const;

export interface WorkspaceFsMock extends Pick<vscode.FileSystem, "stat" | "readDirectory" | "readFile" | "writeFile" | "delete" | "createDirectory"> {}

export interface VsCodeMockOptions {
	workspaceFolders?: string[];
	fsOverrides?: Partial<WorkspaceFsMock>;
}

export function createMockUri(fsPath: string): vscode.Uri {
	const normalized = path.resolve(fsPath);
	const uri = {
		fsPath: normalized,
		path: normalized,
		scheme: "file",
		authority: "",
		fragment: "",
		query: "",
		with: (change: Partial<{ path: string }>) => createMockUri(change.path ?? normalized),
		toString: () => normalized,
		toJSON: () => ({ fsPath: normalized })
	};
	return uri as unknown as vscode.Uri;
}

export function createWorkspaceFsMock(): WorkspaceFsMock {
	return {
		async stat(uri) {
			const stats = await fs.stat(uri.fsPath);
			return {
				type: stats.isDirectory() ? mockFileType.Directory : mockFileType.File,
				ctime: stats.ctimeMs,
				mtime: stats.mtimeMs,
				size: stats.size
			};
		},
		async readDirectory(uri) {
			const entries = await fs.readdir(uri.fsPath, { withFileTypes: true });
			return entries.map(entry => [entry.name, entry.isDirectory() ? mockFileType.Directory : mockFileType.File]) as Array<[string, vscode.FileType]>;
		},
		async readFile(uri) {
			return fs.readFile(uri.fsPath);
		},
		async writeFile(uri, contents) {
			await fs.writeFile(uri.fsPath, Buffer.from(contents));
		},
		async delete(uri, options) {
			await fs.rm(uri.fsPath, { recursive: options?.recursive ?? false, force: true });
		},
		async createDirectory(uri) {
			await fs.mkdir(uri.fsPath, { recursive: true });
		}
	};
}

class Disposable {
	public constructor(private readonly teardown: () => void = () => {}) {}
	public dispose(): void { this.teardown(); }
}

class EventEmitter<T> {
	private listeners: Array<(value: T) => void> = [];
	public readonly event = (listener: (value: T) => unknown): Disposable => {
		this.listeners.push(listener);
		return new Disposable(() => {
			this.listeners = this.listeners.filter((entry) => entry !== listener);
		});
	};
	public fire(value: T): void {
		for (const listener of [...this.listeners]) {
			listener(value);
		}
	}
	public dispose(): void {
		this.listeners = [];
	}
}

function createFileSystemWatcherMock(): vscode.FileSystemWatcher {
	const register = () => new Disposable();
	return {
		onDidCreate: register,
		onDidDelete: register,
		onDidChange: register,
		dispose: () => {}
	} as unknown as vscode.FileSystemWatcher;
}

class TreeItem implements vscode.TreeItem {
	public description?: string | boolean;
	public resourceUri?: vscode.Uri;
	public tooltip?: string | vscode.MarkdownString | undefined;
	public iconPath?: string | vscode.Uri | { light: vscode.Uri; dark: vscode.Uri } | vscode.ThemeIcon | undefined;
	public command?: vscode.Command;
	public contextValue?: string;
	public checkboxState?: vscode.TreeItemCheckboxState;

	public constructor(
		public resourceUriOrLabel: string | vscode.Uri,
		public collapsibleState: vscode.TreeItemCollapsibleState
	) {
		if (typeof resourceUriOrLabel !== "string") {
			this.resourceUri = resourceUriOrLabel;
		}
	}

	public get label(): string | vscode.TreeItemLabel | undefined {
		if (typeof this.resourceUriOrLabel === "string") {
			return this.resourceUriOrLabel;
		}
		return path.basename(this.resourceUriOrLabel.fsPath);
	}

	public set label(value: string | vscode.TreeItemLabel | undefined) {
		if (typeof value === "string") {
			this.resourceUriOrLabel = value;
		}
	}
}

export function createVsCodeMock(options: VsCodeMockOptions = {}): typeof import("vscode") {
	const fsMock = { ...createWorkspaceFsMock(), ...options.fsOverrides };
	const workspaceFolders = options.workspaceFolders?.map((folderPath, index) => ({
		uri: createMockUri(folderPath),
		name: path.basename(folderPath),
		index
	}));

	return {
		Uri: {
			file: (targetPath: string) => createMockUri(targetPath),
			joinPath: (base: vscode.Uri, ...segments: string[]) => createMockUri(path.join(base.fsPath, ...segments))
		},
		workspace: {
			fs: fsMock,
			workspaceFolders,
			createFileSystemWatcher: () => createFileSystemWatcherMock()
		},
		FileType: mockFileType,
		TreeItem,
		TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
		TreeItemCheckboxState: { Unchecked: 0, Checked: 1, Intermediate: 2 },
		EventEmitter,
		Disposable
	} as unknown as typeof import("vscode");
}

export class MockFileTreeProvider {
	public readonly checkedPaths: Set<string> = new Set<string>();

	public constructor(private readonly directoryMap: Record<string, string[]>) {}

	public async getChildren(parent: vscode.Uri): Promise<vscode.Uri[]> {
		const children: string[] = this.directoryMap[parent.fsPath] ?? [];
		return children.map((childPath) => createMockUri(childPath));
	}

	public async getParent(child: vscode.Uri): Promise<vscode.Uri | undefined> {
		for (const [potentialParent, children] of Object.entries(this.directoryMap)) {
			if (children.includes(child.fsPath)) {
				return createMockUri(potentialParent);
			}
		}
		return undefined;
	}
}
