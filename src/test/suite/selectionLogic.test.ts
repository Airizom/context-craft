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

	test("unchecking a file inside a selected folder re-balances siblings", async () => {
		provider.checkedPaths.add(folderA);

		await toggleSelection(vscode.Uri.file(fileA1), false, provider as any);

		assert.ok(!provider.checkedPaths.has(folderA), "parent folder should be deselected");
		assert.ok(!provider.checkedPaths.has(fileA1), "fileA1 should be deselected");
		assert.ok(provider.checkedPaths.has(fileA2), "fileA2 should have been re-selected to compensate");
	});

	test("unchecking a deep descendant only deselects that leaf", async () => {
		const root = "/tmp/root";
		const folder = path.join(root, "folder");
		const sub = path.join(folder, "sub");
		const a = path.join(sub, "a.txt");
		const b = path.join(sub, "b.txt");

		const map: Record<string, string[]> = {
			[root]:   [folder],
			[folder]: [sub],
			[sub]:    [a, b],
		};
		const provider = new MockFileTreeProvider(map);

		provider.checkedPaths.add(folder);

		await toggleSelection(vscode.Uri.file(a), false, provider as any);

		assert.deepStrictEqual(
			Array.from(provider.checkedPaths).sort(),
			[b],
			"deselecting leaf should keep its siblings selected"
		);
	});
}); 