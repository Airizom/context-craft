import { encode } from "gpt-tokenizer/encoding/cl100k_base";
import * as vscode from "vscode";
import { isBinary } from "./utils";

export async function countTokens(paths: string[]): Promise<number> {
    let totalTokens = 0;

    for (const absPath of paths) {
        try {
            const stats = await vscode.workspace.fs.stat(vscode.Uri.file(absPath));
            if (stats.size > 200_000) {
                continue;
            }
            if (await isBinary(absPath)) { 
                continue; 
            }

            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(absPath));
            const text = Buffer.from(bytes).toString("utf8");
            totalTokens += encode(text).length;
        } catch (error) {
            console.error(`Error processing file ${absPath} for token count:`, error);
        }
    }
    return totalTokens;
} 