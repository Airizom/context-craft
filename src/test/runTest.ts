import * as path from "path";
import { runTests } from "@vscode/test-electron";

async function main(): Promise<void> {
	const extensionDevelopmentPath: string = path.resolve(__dirname, "../../..");

	const extensionTestsPath: string = path.resolve(__dirname, "./suite");

	try {
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: ["--disable-extensions"]
		});
	} catch (error) {
		console.error("❌ VS Code tests failed:", error);
		process.exit(1);
	}
}

main(); 