import * as path from "path";
import { glob } from "glob";

export async function run(): Promise<void> {
	const testsRoot = path.resolve(__dirname, "./");
	
	try {
		const files = await glob("**/*.test.js", { cwd: testsRoot });
		
		for (const file of files) {
			require(path.resolve(testsRoot, file));
		}
	} catch (err) {
		console.error("Error loading test files:", err);
		throw err;
	}
} 