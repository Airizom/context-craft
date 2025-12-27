import * as assert from "assert";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import proxyquire = require("proxyquire");
import type * as vscode from "vscode";
import ignore from "ignore";
import { createMockUri, createVsCodeMock } from "../mocks";

const proxyquireNoCallThru = proxyquire.noCallThru();
const vscodeMock = createVsCodeMock();
const { collectFiles } = proxyquireNoCallThru("../../services/fileCollector", {
	vscode: vscodeMock
}) as typeof import("../../services/fileCollector");
const { isBinary } = proxyquireNoCallThru("../../utils/binary", {
	vscode: vscodeMock
}) as typeof import("../../utils/binary");

suite("utils helpers", () => {
	let tempRoot: string;
	const toUri = (target: string): vscode.Uri => createMockUri(target);

	suiteSetup(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
	});

	suiteTeardown(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	setup(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
		await fs.mkdir(tempRoot, { recursive: true });
	});

	teardown(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	test("collectFiles() respects ignore rules", async function () {
		this.timeout(3000);
		const subDir: string = path.join(tempRoot, "subdir");
		await fs.mkdir(subDir);
		
		const included: string = path.join(subDir, "included.txt");
		const ignored: string   = path.join(subDir, "ignored.txt");

		await fs.writeFile(included, "hello");
		await fs.writeFile(ignored, "good-bye");

		const ignoreParser = ignore().add("ignored.txt");
		const collected: string[] = await collectFiles(
			toUri(subDir),
			ignoreParser,
			toUri(tempRoot)
		);

		assert.deepStrictEqual(collected, [included]);
	});

	test("isBinary() detects NUL bytes", async function () {
		this.timeout(3000);
		const textFile: string   = path.join(tempRoot, "plain.txt");
		const binaryFile: string = path.join(tempRoot, "binary.bin");

		await fs.writeFile(textFile,  Buffer.from("just ascii"));
		await fs.writeFile(binaryFile, Buffer.from([0, 1, 2, 3, 4]));

		assert.strictEqual(await isBinary(textFile),  false, "ascii file mis-classified");
		assert.strictEqual(await isBinary(binaryFile), true,  "binary file mis-classified");
	});

	test("collectFiles() handles deep directory nesting with ignore rules", async function () {
		this.timeout(3000);
		const nestedDir = path.join(tempRoot, "nested", "a", "b");
		await fs.mkdir(nestedDir, { recursive: true });
		
		const deepFile = path.join(nestedDir, "c.txt");
		await fs.writeFile(deepFile, "deep content");

		const ignoreParser = ignore().add("nested/");
		const collected: string[] = await collectFiles(
			toUri(nestedDir),
			ignoreParser,
			toUri(tempRoot)
		);

		assert.deepStrictEqual(collected, [], "nested directory should be ignored");
	});

	test("collectFiles() traverses directories deeper than the fsLimit concurrency", async function () {
		this.timeout(3000);
		let currentDir = tempRoot;
		const depth = 30;
		for (let i = 0; i < depth; i++) {
			currentDir = path.join(currentDir, `level-${i}`);
			await fs.mkdir(currentDir);
		}

		const deepFile = path.join(currentDir, "deep.txt");
		await fs.writeFile(deepFile, "deep content");

		const collected: string[] = await collectFiles(
			toUri(tempRoot),
			ignore(),
			toUri(tempRoot)
		);

		assert.ok(collected.includes(deepFile), "deeply nested file should be collected");
	});
});
