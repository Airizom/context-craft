import * as vscode from "vscode";
import { FileTreeProvider } from "../tree/FileTreeProvider";

export function registerRefreshCommand(
    context: vscode.ExtensionContext,
    _fileTreeProvider: FileTreeProvider,
    debouncedRefreshAndUpdate: () => void
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("contextCraft.refresh", () => {
            debouncedRefreshAndUpdate();
        })
    );
} 