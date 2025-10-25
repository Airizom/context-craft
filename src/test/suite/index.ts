import * as path from "path";
import * as fs from "fs";
import Mocha = require("mocha");
import { globSync } from "glob";

function loadMochaOptions(): Mocha.MochaOptions {
	const configPath = path.resolve(__dirname, "../../..", ".mocharc.json");
	try {
		const raw = fs.readFileSync(configPath, "utf8");
		return JSON.parse(raw) as Mocha.MochaOptions;
	} catch (error) {
		console.warn(`Unable to read ${configPath}; falling back to defaults.`, error);
		return {
			timeout: 10000,
			slow: 2000,
			retries: 1,
			reporter: "spec",
			color: true
		};
	}
}

export async function run(): Promise<void> {
	const options = loadMochaOptions();
	const mocha = new Mocha(options);
	const testsRoot = path.resolve(__dirname, "./");
	const files = globSync("**/*.test.js", { cwd: testsRoot, absolute: true });

	for (const file of files) {
		mocha.addFile(file);
	}

	await mocha.loadFilesAsync();

	await new Promise<void>((resolve, reject) => {
		mocha.run(failures => {
			if (failures > 0) {
				reject(new Error(`${failures} test(s) failed.`));
			} else {
				resolve();
			}
		});
	});
}
