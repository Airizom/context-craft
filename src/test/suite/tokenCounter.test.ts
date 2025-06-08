import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { countTokens } from "../../tokenCounter";

suite("countTokens()", () => {
	let tempFile: string;

	setup(async () => {
		const tempRoot: string = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
		tempFile = path.join(tempRoot, "sample.txt");
		await fs.writeFile(tempFile, "Hello world – token test");
	});

	test("returns the same value as the reference tokenizer for a small text file", async () => {
		const expectedTokenCount: number = encode("Hello world – token test").length;
		const actualTokenCount: number   = await countTokens([tempFile]);

		assert.strictEqual(actualTokenCount, expectedTokenCount);
	});

	test("caches results until the file changes", async () => {
		const first: number = await countTokens([tempFile]);

		await vscode.workspace.fs.writeFile(vscode.Uri.file(tempFile), Buffer.from("Hello world – token test"));

		const second: number = await countTokens([tempFile]);
		assert.strictEqual(second, first, "cache should have been hit");
	});

	test("returns 0 for oversized files", async () => {
		const tempRoot: string = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
		const largeFile: string = path.join(tempRoot, "large.txt");
		
		const largeContent = "x".repeat(210 * 1024);
		await fs.writeFile(largeFile, largeContent);

		const tokenCount: number = await countTokens([largeFile]);
		assert.strictEqual(tokenCount, 0, "oversized file should return 0 tokens");
	});

	test("returns 0 for binary files", async () => {
		const tempRoot: string = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
		const binaryFile: string = path.join(tempRoot, "binary.bin");
		
		const binaryContent = Buffer.from([0, 1, 2, 3, 4]);
		await fs.writeFile(binaryFile, binaryContent);

		const tokenCount: number = await countTokens([binaryFile]);
		assert.strictEqual(tokenCount, 0, "binary file should return 0 tokens");
	});
}); 