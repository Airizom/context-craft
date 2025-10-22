import * as vscode from "vscode";
import { FileTreeProvider } from "../FileTreeProvider";

export function registerSelectGitChangesCommand(
	context: vscode.ExtensionContext,
	fileTreeProvider: FileTreeProvider,
	debouncedRefreshAndUpdate: () => void
): void {
	const disposable = vscode.commands.registerCommand(
		"contextCraft.selectGitChanges",
		async () => {
			// Get the Git extension API
			const gitExtension = vscode.extensions.getExtension("vscode.git");
			if (!gitExtension) {
				vscode.window.showWarningMessage("Git extension is not available");
				return;
			}

			const git = gitExtension.isActive
				? gitExtension.exports
				: await gitExtension.activate();

			if (!git) {
				vscode.window.showWarningMessage("Unable to access Git API");
				return;
			}

			const api = git.getAPI(1);
			if (!api || api.repositories.length === 0) {
				vscode.window.showInformationMessage("No Git repositories found in workspace");
				return;
			}

			// Get all changed files from all repositories
			const changedFiles = new Set<string>();

			for (const repo of api.repositories) {
				// Get the working tree changes (modified, added, deleted)
				const workingTreeChanges = repo.state.workingTreeChanges;
				const indexChanges = repo.state.indexChanges;
				const mergeChanges = repo.state.mergeChanges;

				// Combine all changes
				const allChanges = [
					...workingTreeChanges,
					...indexChanges,
					...mergeChanges
				];

				for (const change of allChanges) {
					if (change.uri) {
						changedFiles.add(change.uri.fsPath);
					}
				}
			}

			if (changedFiles.size === 0) {
				vscode.window.showInformationMessage("No uncommitted changes found");
				return;
			}

			// Clear existing selections and add the changed files
			fileTreeProvider.checkedPaths.clear();
			for (const filePath of changedFiles) {
				fileTreeProvider.checkedPaths.add(filePath);
			}

			// Persist and refresh
			await context.workspaceState.update(
				"contextCraft.selectedPaths",
				Array.from(fileTreeProvider.checkedPaths)
			);

			debouncedRefreshAndUpdate();

			vscode.window.showInformationMessage(
				`Selected ${changedFiles.size} file${changedFiles.size === 1 ? "" : "s"} with uncommitted changes`
			);
		}
	);
	context.subscriptions.push(disposable);
}
