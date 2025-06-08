import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import { getIgnoreParser } from "../../getIgnoreParser";

suite("getIgnoreParser", () => {
	let tempRoot: string;
	let gitignoreFile: string;

	setup(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
		gitignoreFile = path.join(tempRoot, ".gitignore");
	});

	teardown(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	test("caches parser and refreshes when .gitignore changes", async () => {
		await fs.writeFile(gitignoreFile, "*.log\n");
		
		const parser1 = await getIgnoreParser(vscode.Uri.file(tempRoot));
		const parser2 = await getIgnoreParser(vscode.Uri.file(tempRoot));
		
		assert.strictEqual(parser1, parser2, "should return cached parser for same mtime");
		
		await new Promise(resolve => setTimeout(resolve, 10));
		await fs.writeFile(gitignoreFile, "*.log\n*.tmp\n");
		
		const parser3 = await getIgnoreParser(vscode.Uri.file(tempRoot));
		
		assert.notStrictEqual(parser1, parser3, "should return new parser after file change");
		assert.ok(parser3.ignores("test.tmp"), "new parser should include updated rules");
	});
}); 