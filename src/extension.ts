import * as vscode from "vscode";
import { registerCommands } from "./commands";
import { updateSelectedPaths } from "./commands/commandUtils";
import { createRefreshController } from "./app/refreshController";
import { createStatusUi } from "./app/statusUi";
import { registerTreeViewFocus } from "./app/treeViewFocus";
import { STATE_KEY_SELECTED } from "./constants";
import { toggleSelection } from "./selection/selectionLogic";
import { pruneSelectionsOutsideWorkspace, resolveSelectedFiles } from "./selection/selectionResolver";
import { countTokens } from "./services/tokenCounter";
import { FileTreeProvider } from "./tree/FileTreeProvider";

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	let debouncedRefreshAndUpdate: () => void = () => {};

	const persisted: string[] =
		context.workspaceState.get<string[]>(STATE_KEY_SELECTED) ?? [];
	const fileTreeProvider = new FileTreeProvider(
		new Set(persisted),
		context,
		() => debouncedRefreshAndUpdate()
	);

	const treeView = vscode.window.createTreeView("contextCraftFileBrowser", {
		treeDataProvider: fileTreeProvider,
		showCollapseAll: true,
		canSelectMany: true,
		manageCheckboxStateManually: true
	});
	context.subscriptions.push(treeView);

	const statusUi = createStatusUi(context, treeView);
	const refreshController = createRefreshController({
		fileTreeProvider,
		resolveSelectedFiles,
		countTokens,
		statusUi,
		pruneSelectionsOutsideWorkspace,
		persistSelections: () => updateSelectedPaths(context, fileTreeProvider)
	});
	debouncedRefreshAndUpdate = refreshController.debouncedRefreshAndUpdate;

	registerCommands(context, {
		fileTreeProvider,
		resolveSelectedFiles,
		refresh: refreshController.debouncedRefreshAndUpdate
	});

	const checkboxDisposable = treeView.onDidChangeCheckboxState(async (event) => {
		try {
			const togglePromises: Promise<void>[] = [];
			console.log(`[ContextCraft] checkbox change items=${event.items.length}`);
			for (const [element, checkboxState] of event.items) {
				togglePromises.push(
					toggleSelection(
						element,
						checkboxState === vscode.TreeItemCheckboxState.Checked,
						fileTreeProvider
					)
				);
			}
			await Promise.all(togglePromises);
			console.log(`[ContextCraft] checkbox toggled; checkedPaths.size=${fileTreeProvider.checkedPaths.size}`);
			// Persist selection state, but do not block UI updates
			void updateSelectedPaths(context, fileTreeProvider).then(undefined, (err: unknown) =>
				console.error("[ContextCraft] workspaceState update failed", err)
			);
		} catch (error) {
			console.error("[ContextCraft] Checkbox handler failed:", error);
		} finally {
			await refreshController.refreshAndUpdate();
		}
	});
	context.subscriptions.push(checkboxDisposable);

	registerTreeViewFocus(context, treeView);

	debouncedRefreshAndUpdate();

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(() => {
			void refreshController.handleWorkspaceFoldersChanged();
		})
	);
}

export function deactivate(): void {
	// noop
}
