import * as assert from "assert";
import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import ignore from "ignore";
import { collectFiles, isBinary } from "../../utils";

suite("utils helpers", () => {
	let tempRoot: string;

	setup(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
	});

	teardown(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	test("collectFiles() respects ignore rules", async () => {
		const subDir: string = path.join(tempRoot, "subdir");
		await fs.mkdir(subDir);
		
		const included: string = path.join(subDir, "included.txt");
		const ignored: string   = path.join(subDir, "ignored.txt");

		await fs.writeFile(included, "hello");
		await fs.writeFile(ignored, "good-bye");

		const ignoreParser = ignore().add("ignored.txt");
		const collected: string[] = await collectFiles(
			vscode.Uri.file(subDir),
			ignoreParser,
			vscode.Uri.file(tempRoot)
		);

		assert.deepStrictEqual(collected, [included]);
	});

	test("isBinary() detects NUL bytes", async () => {
		const textFile: string   = path.join(tempRoot, "plain.txt");
		const binaryFile: string = path.join(tempRoot, "binary.bin");

		await fs.writeFile(textFile,  Buffer.from("just ascii"));
		await fs.writeFile(binaryFile, Buffer.from([0, 1, 2, 3, 4]));

		assert.strictEqual(await isBinary(textFile),  false, "ascii file mis-classified");
		assert.strictEqual(await isBinary(binaryFile), true,  "binary file mis-classified");
	});

	test("collectFiles() handles deep directory nesting with ignore rules", async () => {
		const nestedDir = path.join(tempRoot, "nested", "a", "b");
		await fs.mkdir(nestedDir, { recursive: true });
		
		const deepFile = path.join(nestedDir, "c.txt");
		const allowedFile = path.join(tempRoot, "allowed.txt");
		await fs.writeFile(deepFile, "deep content");
		await fs.writeFile(allowedFile, "allowed content");

		const ignoreParser = ignore().add("nested/");
		const collected: string[] = await collectFiles(
			vscode.Uri.file(nestedDir),
			ignoreParser,
			vscode.Uri.file(tempRoot)
		);

		assert.deepStrictEqual(collected, [], "nested directory should be ignored");
	});
}); 