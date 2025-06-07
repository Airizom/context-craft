import * as vscode from "vscode";
import { FileTreeProvider } from "../FileTreeProvider";
import { STATE_KEY_SELECTED } from "../constants";

export function registerUnselectAllCommand(
    context: vscode.ExtensionContext,
    fileTreeProvider: FileTreeProvider,
    debouncedRefreshAndUpdate: () => void
): void {
    context.subscriptions.push(
        vscode.commands.registerCommand("contextCraft.unselectAll", async () => {
            fileTreeProvider.checkedPaths.clear();
            await context.workspaceState.update(STATE_KEY_SELECTED, []);
            debouncedRefreshAndUpdate();
        })
    );
} 