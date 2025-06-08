import * as assert from "assert";
import * as vscode from "vscode";
import { FileTreeProvider } from "../../FileTreeProvider";

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
}); 