import * as vscode from "vscode";

export function registerTreeViewFocus(
	context: vscode.ExtensionContext,
	treeView: vscode.TreeView<vscode.Uri>
): void {
	const focusActiveEditorInTree = (options?: { skipIfSelected?: boolean }) => {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return;
		}
		const documentUri = activeEditor.document.uri;
		if (documentUri.scheme !== "file") {
			return;
		}
		if (!vscode.workspace.getWorkspaceFolder(documentUri)) {
			return;
		}
		if (options?.skipIfSelected) {
			const alreadySelected = treeView.selection.some(
				(selectedUri) => selectedUri.fsPath === documentUri.fsPath
			);
			if (alreadySelected) {
				return;
			}
		}
		treeView.reveal(
			documentUri,
			{
				select: true,
				focus: true,
				expand: true
			}
		).then(undefined, (error: unknown) => {
			console.error("Could not reveal in tree:", error);
		});
	};

	const visibilityDisposable = treeView.onDidChangeVisibility((event) => {
		if (!event.visible) {
			return;
		}
		focusActiveEditorInTree({ skipIfSelected: true });
	});
	context.subscriptions.push(visibilityDisposable);

	if (treeView.visible) {
		focusActiveEditorInTree({ skipIfSelected: true });
	}

	context.subscriptions.push(
		vscode.window.onDidChangeActiveTextEditor(() => {
			if (!treeView.visible) {
				return;
			}
			focusActiveEditorInTree({ skipIfSelected: true });
		})
	);
}
