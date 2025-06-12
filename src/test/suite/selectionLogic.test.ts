import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";
import { toggleSelection } from "../../selectionLogic";

class MockFileTreeProvider {
	public readonly checkedPaths: Set<string> = new Set<string>();

	public constructor(private readonly directoryMap: Record<string, string[]>) { }

	public async getChildren(parent: vscode.Uri): Promise<vscode.Uri[]> {
		const children: string[] = this.directoryMap[parent.fsPath] ?? [];
		return children.map((childPath) => vscode.Uri.file(childPath));
	}
}

suite("toggleSelection()", () => {
	const root: string = path.join(__dirname, "fixtures");
	const folderA: string = path.join(root, "folderA");
	const folderB: string = path.join(root, "folderB");
	const fileA1: string = path.join(folderA, "fileA1.txt");
	const fileA2: string = path.join(folderA, "fileA2.txt");
	const fileB1: string = path.join(folderB, "fileB1.txt");

	const directoryMap: Record<string, string[]> = {
		[root]: [folderA, folderB],
		[folderA]: [fileA1, fileA2],
		[folderB]: [fileB1]
	};

	let provider: MockFileTreeProvider;

	setup(() => {
		provider = new MockFileTreeProvider(directoryMap);
	});

	test("checking a folder selects only that folder, not its children", async () => {
		await toggleSelection(vscode.Uri.file(folderA), true, provider as any);
		assert.deepStrictEqual(Array.from(provider.checkedPaths), [folderA]);
	});

	test("checking a file inside a selected folder replaces folder selection with file selection", async () => {
		provider.checkedPaths.add(folderA);
		await toggleSelection(vscode.Uri.file(fileA1), true, provider as any);
		assert.deepStrictEqual(Array.from(provider.checkedPaths), [fileA1]);
	});
});

suite("toggleSelection edge cases", () => {
	const root: string = path.join(__dirname, "fixtures2");
	const folderA: string = path.join(root, "folderA");
	const folderB: string = path.join(root, "folderB");
	const fileA1: string = path.join(folderA, "fileA1.txt");
	const fileA2: string = path.join(folderA, "fileA2.txt");

	const dirMap: Record<string, string[]> = {
		[root]: [folderA, folderB],
		[folderA]: [fileA1, fileA2]
	};

	let provider: MockFileTreeProvider;

	setup(() => {
		provider = new MockFileTreeProvider(dirMap);
	});

	test("unchecking a folder clears all descendants", async () => {
		provider.checkedPaths.add(folderA);
		await toggleSelection(vscode.Uri.file(folderA), false, provider as any);
		assert.deepStrictEqual(Array.from(provider.checkedPaths), []);
	});

	test("unchecking a single file leaves others intact", async () => {
		provider.checkedPaths.add(fileA1);
		provider.checkedPaths.add(fileA2);
		await toggleSelection(vscode.Uri.file(fileA1), false, provider as any);
		assert.deepStrictEqual(Array.from(provider.checkedPaths), [fileA2]);
	});

	test("selecting folder when file already selected replaces with folder", async () => {
		provider.checkedPaths.add(fileA1);
		await toggleSelection(vscode.Uri.file(folderA), true, provider as any);
		assert.deepStrictEqual(Array.from(provider.checkedPaths), [folderA]);
	});

	test("selecting two unrelated folders keeps both", async () => {
		await toggleSelection(vscode.Uri.file(folderA), true, provider as any);
		await toggleSelection(vscode.Uri.file(folderB), true, provider as any);
		assert.deepStrictEqual(new Set(provider.checkedPaths), new Set([folderA, folderB]));
	});
}); 