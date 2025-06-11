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
               (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file(root), name: "root", index: 0 }];

               const provider = new FileTreeProvider(new Set(), { subscriptions: { push: () => {} } } as any, () => {});
               const isIgnored = (provider as any).isIgnored.bind(provider);

               assert.strictEqual(await isIgnored(vscode.Uri.file(path.join(root, "ignored.txt"))), true, "file should be ignored");
               assert.strictEqual(await isIgnored(vscode.Uri.file(path.join(root, "subdir"))), true, "dir should be ignored");
               assert.strictEqual(await isIgnored(vscode.Uri.file(path.join(root, "included.txt"))), false, "included file should not be ignored");

               (vscode.workspace as any).workspaceFolders = prev;
               await fs.rm(root, { recursive: true, force: true });
       });

       test("getChildren filters out ignored entries", async () => {
               const root = await fs.mkdtemp(path.join(os.tmpdir(), "cc-ft-"));
               await fs.writeFile(path.join(root, ".gitignore"), "ignored.txt\nsubdir/\n");
               await fs.writeFile(path.join(root, "ignored.txt"), "data");
               await fs.writeFile(path.join(root, "included.txt"), "ok");
               await fs.mkdir(path.join(root, "subdir"));

               const prev = vscode.workspace.workspaceFolders;
               (vscode.workspace as any).workspaceFolders = [{ uri: vscode.Uri.file(root), name: "root", index: 0 }];

               const provider = new FileTreeProvider(new Set(), { subscriptions: { push: () => {} } } as any, () => {});
               const children = await provider.getChildren();
               const names = children.map(c => path.basename(c.fsPath));

               assert.deepStrictEqual(names.sort(), ["included.txt"], "only non-ignored file should appear");

               (vscode.workspace as any).workspaceFolders = prev;
               await fs.rm(root, { recursive: true, force: true });
       });
});
