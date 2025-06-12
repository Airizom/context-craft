import * as assert from "assert";
import * as vscode from "vscode";
import { FileTreeProvider } from "../../FileTreeProvider";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

suite("FileTreeProvider", () => {
        test("shouldIgnoreWatcherEvent ignores common directories", () => {
		const mockContext = {
			subscriptions: {
				push: () => {}
			}
		};
		const provider = new FileTreeProvider(new Set(), mockContext as any, () => {});
		
		const shouldIgnore = (provider as any).shouldIgnoreWatcherEvent.bind(provider);
		
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/node_modules/foo.js")), true, "should ignore node_modules");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/.git/config")), true, "should ignore .git");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/.vscode/settings.json")), true, "should ignore .vscode");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/dist/bundle.js")), true, "should ignore dist");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/build/output.js")), true, "should ignore build");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/out/compiled.js")), true, "should ignore out");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/target/classes")), true, "should ignore target");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/.next/cache")), true, "should ignore .next");
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/.nuxt/dist")), true, "should ignore .nuxt");
		
		assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/src/index.ts")), false, "should not ignore src files");
                assert.strictEqual(shouldIgnore(vscode.Uri.file("/tmp/proj/README.md")), false, "should not ignore root files");
        });

       test("isIgnored respects .gitignore rules", async () => {
               const root = await fs.mkdtemp(path.join(os.tmpdir(), "cc-ft-"));
               await fs.writeFile(path.join(root, ".gitignore"), "ignored.txt\nsubdir/\n");
               await fs.writeFile(path.join(root, "ignored.txt"), "data");
               await fs.writeFile(path.join(root, "included.txt"), "ok");
               await fs.mkdir(path.join(root, "subdir"));

               const prev = vscode.workspace.workspaceFolders;
               Object.defineProperty(vscode.workspace, "workspaceFolders", {
                       get: () => [{ uri: vscode.Uri.file(root), name: "root", index: 0 }],
                       configurable: true
               });

               const provider = new FileTreeProvider(new Set(), { subscriptions: { push: () => {} } } as any, () => {});
               const isIgnored = (provider as any).isIgnored.bind(provider);

               assert.strictEqual(await isIgnored(vscode.Uri.file(path.join(root, "ignored.txt"))), true, "file should be ignored");
               assert.strictEqual(await isIgnored(vscode.Uri.file(path.join(root, "subdir"))), true, "dir should be ignored");
               assert.strictEqual(await isIgnored(vscode.Uri.file(path.join(root, "included.txt"))), false, "included file should not be ignored");

               Object.defineProperty(vscode.workspace, "workspaceFolders", {
                       get: () => prev,
                       configurable: true
               });
               await fs.rm(root, { recursive: true, force: true });
       });

       test("getChildren filters out ignored entries", async () => {
               const root = await fs.mkdtemp(path.join(os.tmpdir(), "cc-ft-"));
               await fs.writeFile(path.join(root, ".gitignore"), "ignored.txt\nsubdir/\n");
               await fs.writeFile(path.join(root, "ignored.txt"), "data");
               await fs.writeFile(path.join(root, "included.txt"), "ok");
               await fs.mkdir(path.join(root, "subdir"));

               const prev = vscode.workspace.workspaceFolders;
               Object.defineProperty(vscode.workspace, "workspaceFolders", {
                       get: () => [{ uri: vscode.Uri.file(root), name: "root", index: 0 }],
                       configurable: true
               });

               const provider = new FileTreeProvider(new Set(), { subscriptions: { push: () => {} } } as any, () => {});
               const children = await provider.getChildren();
               const names = children.map(c => path.basename(c.fsPath));

               assert.deepStrictEqual(names.sort(), ["included.txt"], "only non-ignored file should appear");

               Object.defineProperty(vscode.workspace, "workspaceFolders", {
                       get: () => prev,
                       configurable: true
               });
               await fs.rm(root, { recursive: true, force: true });
       });

       test("children appear checked when parent folder is selected", async () => {
               const mockContext = { subscriptions: { push: () => {} } };

               const folder = "/tmp/proj/folderA";
               const fileInFolder = "/tmp/proj/folderA/file1.txt";

               const provider = new FileTreeProvider(new Set([folder]), mockContext as any, () => {});

               const stateChild = (provider as any).computeCheckboxState(vscode.Uri.file(fileInFolder));

               assert.strictEqual(stateChild, vscode.TreeItemCheckboxState.Checked, "child should inherit checked state from parent folder");
       });
});

suite("computeCheckboxState comprehensive", () => {
	const ctx = { subscriptions: { push: () => {} } };

	const root = "/tmp/cc-root";
	const folder = `${root}/folder`;
	const subFolder = `${folder}/sub`;
	const subFile = `${subFolder}/file.txt`;
	const siblingFile = `${root}/sibling.txt`;

	function state(provider: FileTreeProvider, p: string): vscode.TreeItemCheckboxState {
		return (provider as any).computeCheckboxState(vscode.Uri.file(p));
	}

	test("nothing selected -> everything unchecked", () => {
		const provider = new FileTreeProvider(new Set(), ctx as any, () => {});
		assert.strictEqual(state(provider, folder), vscode.TreeItemCheckboxState.Unchecked);
		assert.strictEqual(state(provider, subFile), vscode.TreeItemCheckboxState.Unchecked);
	});

	test("file selected -> file checked, parent folder checked, sibling unchecked", () => {
		const provider = new FileTreeProvider(new Set([subFile]), ctx as any, () => {});
		assert.strictEqual(state(provider, subFile), vscode.TreeItemCheckboxState.Checked, "explicit file");
		assert.strictEqual(state(provider, subFolder), vscode.TreeItemCheckboxState.Checked, "ancestor folder");
		assert.strictEqual(state(provider, folder), vscode.TreeItemCheckboxState.Checked, "top ancestor folder");
		assert.strictEqual(state(provider, siblingFile), vscode.TreeItemCheckboxState.Unchecked, "unrelated sibling file");
	});

	test("folder selected -> folder and descendants checked, unrelated paths unchecked", () => {
		const provider = new FileTreeProvider(new Set([folder]), ctx as any, () => {});
		assert.strictEqual(state(provider, folder), vscode.TreeItemCheckboxState.Checked, "selected folder");
		assert.strictEqual(state(provider, subFolder), vscode.TreeItemCheckboxState.Checked, "descendant folder inherits check");
		assert.strictEqual(state(provider, subFile), vscode.TreeItemCheckboxState.Checked, "grandchild file inherits check");
		assert.strictEqual(state(provider, siblingFile), vscode.TreeItemCheckboxState.Unchecked, "unrelated sibling file");
	});

	test("multiple siblings selected -> parent folder checked", () => {
		const subFile2 = `${subFolder}/file2.txt`;
		const provider = new FileTreeProvider(new Set([subFile, subFile2]), ctx as any, () => {});
		assert.strictEqual(state(provider, subFolder), vscode.TreeItemCheckboxState.Checked, "parent folder should be checked");
	});

	test("ancestor and descendant both in set -> both checked", () => {
		const provider = new FileTreeProvider(new Set([folder, subFile]), ctx as any, () => {});
		assert.strictEqual(state(provider, folder), vscode.TreeItemCheckboxState.Checked, "folder checked");
		assert.strictEqual(state(provider, subFile), vscode.TreeItemCheckboxState.Checked, "file checked");
	});

	test("prefix trap: '/app' should not check '/application'", () => {
		const app = `${root}/app`;
		const applicationFile = `${root}/application/file.txt`;
		const provider = new FileTreeProvider(new Set([app]), ctx as any, () => {});
		assert.strictEqual(state(provider, applicationFile), vscode.TreeItemCheckboxState.Unchecked);
	});
});
