import ignore from "ignore";
import * as vscode from "vscode";
import { ignoreParserCache } from "./extension";

export async function getIgnoreParser(workspaceRootUri: vscode.Uri): Promise<ReturnType<typeof ignore>> {
    const gitIgnoreUri = vscode.Uri.joinPath(workspaceRootUri, ".gitignore");
    try {
        const stat = await vscode.workspace.fs.stat(gitIgnoreUri);
        const cacheKey = workspaceRootUri.fsPath;
        const cached = ignoreParserCache.get(cacheKey);
        if (cached && cached.mtime === stat.mtime) {
            console.log(`[ContextCraft] getIgnoreParser cache hit for ${cacheKey}`);
            return cached.parser;
        }
        const gitIgnoreBytes = await vscode.workspace.fs.readFile(gitIgnoreUri);
		let gitIgnoreContent: string;
		if (typeof TextDecoder !== "undefined") {
			const decoder = new TextDecoder("utf-8");
			gitIgnoreContent = decoder.decode(gitIgnoreBytes);
		} else {
			gitIgnoreContent = Buffer.from(gitIgnoreBytes).toString("utf-8");
		}
        const parser = ignore().add(gitIgnoreContent);
        ignoreParserCache.set(cacheKey, { parser, mtime: stat.mtime });
        console.log(`[ContextCraft] getIgnoreParser loaded .gitignore for ${cacheKey}`);
        return parser;
    } catch {
        console.log(`[ContextCraft] getIgnoreParser no .gitignore for ${workspaceRootUri.fsPath}`);
        return ignore();
    }
}
