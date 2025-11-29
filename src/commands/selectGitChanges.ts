import * as vscode from "vscode";
import { FileTreeProvider } from "../FileTreeProvider";
import { updateSelectedPaths } from "./commandUtils";

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
			const candidateUris = new Map<string, vscode.Uri>();

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
					const resourceUri = change.resourceUri ?? change.uri;
					if (resourceUri) {
						candidateUris.set(resourceUri.fsPath, resourceUri);
					}
				}
			}

			const { selectablePaths, missingCount, outOfWorkspaceCount } = await filterSelectableUris(candidateUris);
			const skippedDetails = formatSkippedDetails(missingCount, outOfWorkspaceCount);

			if (selectablePaths.size === 0) {
				const suffix = skippedDetails ? ` (skipped ${skippedDetails})` : "";
				vscode.window.showInformationMessage(`No uncommitted changes found in current workspace${suffix}`);
				return;
			}

			// Clear existing selections and add the changed files
			fileTreeProvider.checkedPaths.clear();
			for (const filePath of selectablePaths) {
				fileTreeProvider.checkedPaths.add(filePath);
			}

			// Persist and refresh
			await updateSelectedPaths(context, fileTreeProvider);

			debouncedRefreshAndUpdate();

			const skippedSuffix = skippedDetails ? ` (skipped ${skippedDetails})` : "";
			vscode.window.showInformationMessage(
				`Selected ${selectablePaths.size} file${selectablePaths.size === 1 ? "" : "s"} with uncommitted changes${skippedSuffix}`
			);
		}
	);
	context.subscriptions.push(disposable);
}

async function filterSelectableUris(
	candidateUris: Map<string, vscode.Uri>
): Promise<{ selectablePaths: Set<string>; missingCount: number; outOfWorkspaceCount: number }> {
	const selectablePaths = new Set<string>();
	let missingCount = 0;
	let outOfWorkspaceCount = 0;
	const checks = Array.from(candidateUris.entries()).map(async ([fsPath, uri]) => {
		const exists = await uriExists(uri);
		if (!exists) {
			missingCount++;
			return;
		}
		if (!isInWorkspace(uri)) {
			outOfWorkspaceCount++;
			return;
		}
		selectablePaths.add(fsPath);
	});
	await Promise.all(checks);
	return { selectablePaths, missingCount, outOfWorkspaceCount };
}

async function uriExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch (error) {
		if (isFileNotFound(error)) {
			return false;
		}
		console.warn("[ContextCraft] Failed to stat Git change", uri.fsPath, error);
		return true;
	}
}

function isFileNotFound(error: unknown): boolean {
	if (error instanceof vscode.FileSystemError) {
		const code = (error as { code?: string }).code;
		if (code === "FileNotFound") {
			return true;
		}
	}
	if (error instanceof Error) {
		return /FileNotFound|No such file|ENOENT/i.test(error.message);
	}
	return false;
}

function isInWorkspace(uri: vscode.Uri): boolean {
	return vscode.workspace.getWorkspaceFolder(uri) !== undefined;
}

function formatSkippedDetails(missingCount: number, outOfWorkspaceCount: number): string {
	const parts: string[] = [];
	if (missingCount > 0) {
		parts.push(`${missingCount} deleted ${missingCount === 1 ? "entry" : "entries"}`);
	}
	if (outOfWorkspaceCount > 0) {
		parts.push(`${outOfWorkspaceCount} outside current workspace ${outOfWorkspaceCount === 1 ? "file" : "files"}`);
	}
	return parts.join(", ");
}
