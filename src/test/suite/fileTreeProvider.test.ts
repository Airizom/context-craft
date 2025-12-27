import * as assert from "assert";
import proxyquire = require("proxyquire");
import type * as vscode from "vscode";
import { createMockUri, createVsCodeMock } from "../mocks";

const proxyquireNoCallThru = proxyquire.noCallThru();
const vscodeMock = createVsCodeMock({ workspaceFolders: ["/tmp/proj"] });
const { FileTreeProvider } = proxyquireNoCallThru("../../tree/FileTreeProvider", {
	vscode: vscodeMock
}) as typeof import("../../tree/FileTreeProvider");

suite("FileTreeProvider", () => {
	test("shouldIgnoreWatcherEvent ignores common directories", function () {
		this.timeout(1000);
		const mockContext = {
			subscriptions: {
				push: () => {}
			}
		};
		const provider = new FileTreeProvider(new Set(), mockContext as any, () => {});
		
		const shouldIgnore = (provider as any).shouldIgnoreWatcherEvent.bind(provider);
		
		const uri = (target: string): vscode.Uri => createMockUri(target);
		
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/node_modules/foo.js")), true, "should ignore node_modules");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/.git/config")), true, "should ignore .git");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/.vscode/settings.json")), true, "should ignore .vscode");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/dist/bundle.js")), true, "should ignore dist");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/build/output.js")), true, "should ignore build");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/out/compiled.js")), true, "should ignore out");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/target/classes")), true, "should ignore target");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/.next/cache")), true, "should ignore .next");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/.nuxt/dist")), true, "should ignore .nuxt");
		
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/src/index.ts")), false, "should not ignore src files");
		assert.strictEqual(shouldIgnore(uri("/tmp/proj/README.md")), false, "should not ignore root files");
	});
});
