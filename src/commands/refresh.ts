import * as vscode from "vscode";
import { FileTreeProvider } from "../FileTreeProvider";

export function registerRefreshCommand(
    context: vscode.ExtensionContext,
    fileTreeProvider: FileTreeProvider,
    debouncedUpdate: () => void
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("contextCraft.refresh", () => {
            fileTreeProvider.refresh();
            debouncedUpdate();
        })
    );
} 