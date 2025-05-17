import * as vscode from "vscode";
import * as os from "os";
import * as path from "path";
import { FileTreeProvider } from "../FileTreeProvider";
import { isBinary } from "../utils";
import { countTokens } from "../tokenCounter";

export function registerCopySelectedCommand(
    context: vscode.ExtensionContext,
    fileTreeProvider: FileTreeProvider,
    resolveSelectedFiles: (fileTree: FileTreeProvider, root: vscode.Uri) => Promise<string[]>
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("contextCraft.copySelected", async () => {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders || workspaceFolders.length === 0) {
                vscode.window.showWarningMessage(
                    "No workspace folder open. Cannot copy selected files."
                );
                return;
            }
            if (workspaceFolders.length > 1) {
                vscode.window.showWarningMessage(
                    "Multi-root workspaces are not fully supported. Only the first root will be used."
                );
            }
            const workspaceRootUri = workspaceFolders[0].uri;
            const absoluteFiles = (await resolveSelectedFiles(fileTreeProvider, workspaceRootUri)).sort();

            if (absoluteFiles.length === 0) {
                vscode.window.showInformationMessage("No non-ignored files resolved.");
                return;
            }
            let xmlChunks: string[] = ["<code_files>"];
            for (const abs of absoluteFiles) {
                const rel = path.relative(workspaceRootUri.fsPath, abs);
                const fileName = path.basename(rel);
                const xmlPath = rel.split(path.sep).join("/");

                if (await isBinary(abs)) {
                    xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" binary="true"/>`);
                    continue;
                }

                try {
                    const stats = await vscode.workspace.fs.stat(vscode.Uri.file(abs));
                    if (stats.size > 200_000) {
                        xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" truncated="true"/>`);
                        continue;
                    }
                } catch (statError) {
                    console.error(`Error stating file ${abs} for XML generation:`, statError);
                    xmlChunks.push(`  <file name="${fileName}" path="${xmlPath}" error="true" comment="Error checking file size"/>`);
                    continue;
                }

                const bytes = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
                const original = Buffer.from(bytes).toString("utf-8");
                const escaped = original.replaceAll("]]>", "]] ]]]><![CDATA[>");
                xmlChunks.push(
                    `  <file name="${fileName}" path="${xmlPath}"><![CDATA[`,
                    escaped,
                    `]]></file>`
                );
            }
            xmlChunks.push("</code_files>");
            const xmlPayload = xmlChunks.join(os.EOL);
            const tokenCount = await countTokens(absoluteFiles);
            await vscode.env.clipboard.writeText(xmlPayload);
            vscode.window.showInformationMessage(
                `Copied ${absoluteFiles.length} file${absoluteFiles.length === 1 ? "" : "s"} ` +
                    `(${tokenCount} tokens) as XML. Paste anywhere to share or prompt an LLM.`
            );
        })
    );
} 