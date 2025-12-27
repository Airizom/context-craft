import * as assert from "assert";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import proxyquire = require("proxyquire");
import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import { createVsCodeMock } from "../mocks";

const proxyquireNoCallThru = proxyquire.noCallThru();
const vscodeMock = createVsCodeMock();
const asyncLimitModule = proxyquireNoCallThru("../../utils/asyncLimit", {}) as typeof import("../../utils/asyncLimit");
const cacheModule = proxyquireNoCallThru("../../utils/cache", {}) as typeof import("../../utils/cache");
const binaryModule = proxyquireNoCallThru("../../utils/binary", {
	vscode: vscodeMock
}) as typeof import("../../utils/binary");
const { countTokens } = proxyquireNoCallThru("../../services/tokenCounter", {
	vscode: vscodeMock,
	"../utils/asyncLimit": asyncLimitModule,
	"../utils/binary": binaryModule,
	"../utils/cache": cacheModule
}) as typeof import("../../services/tokenCounter");

suite("countTokens()", () => {
	let tempRoot: string;
	let tempFile: string;

	suiteSetup(async () => {
		tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "context-craft-"));
	});

	suiteTeardown(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
	});

	setup(async () => {
		await fs.rm(tempRoot, { recursive: true, force: true });
		await fs.mkdir(tempRoot, { recursive: true });
		tempFile = path.join(tempRoot, "sample.txt");
		await fs.writeFile(tempFile, "Hello world – token test");
	});

	test("returns the same value as the reference tokenizer for a small text file", async function () {
		this.timeout(3000);
		const expectedTokenCount: number = encode("Hello world – token test").length;
		const actualTokenCount: number   = await countTokens([tempFile]);

		assert.strictEqual(actualTokenCount, expectedTokenCount);
	});

	test("caches results until the file changes", async function () {
		this.timeout(3000);
		const first: number = await countTokens([tempFile]);

		await fs.writeFile(tempFile, "Hello world – token test");

		const second: number = await countTokens([tempFile]);
		assert.strictEqual(second, first, "cache should have been hit");
	});

	test("returns 0 for oversized files", async function () {
		this.timeout(3000);
		const largeFile: string = path.join(tempRoot, "large.txt");

		const largeContent = "x".repeat(210 * 1024);
		await fs.writeFile(largeFile, largeContent);

		const tokenCount: number = await countTokens([largeFile]);
		assert.strictEqual(tokenCount, 0, "oversized file should return 0 tokens");
	});

	test("returns 0 for binary files", async function () {
		this.timeout(3000);
		const binaryFile: string = path.join(tempRoot, "binary.bin");
		
		const binaryContent = Buffer.from([0, 1, 2, 3, 4]);
		await fs.writeFile(binaryFile, binaryContent);

		const tokenCount: number = await countTokens([binaryFile]);
		assert.strictEqual(tokenCount, 0, "binary file should return 0 tokens");
	});

	test("aborts processing when the AbortSignal fires", async function () {
		this.timeout(3000);
		const anotherFile: string = path.join(tempRoot, "another.txt");
		await fs.writeFile(anotherFile, "Some other content");

		const controller = new AbortController();
		const pending = countTokens([tempFile, anotherFile], controller.signal);
		controller.abort();
		const total: number = await pending;

		assert.strictEqual(total, 0, "aborted requests should short-circuit");

		const followUp = await countTokens([tempFile]);
		assert.ok(followUp > 0, "subsequent requests should still work after abort");
	});
});
