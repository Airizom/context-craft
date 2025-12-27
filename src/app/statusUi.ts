import * as vscode from "vscode";

export interface StatusUi {
	updateCounts: (filesCount: number, tokensCount: number) => void;
	setCalculating: (hint?: string) => void;
	setNoWorkspace: () => void;
}

export function createStatusUi(
	context: vscode.ExtensionContext,
	treeView: vscode.TreeView<vscode.Uri>
): StatusUi {
	const tokenStatusBar = vscode.window.createStatusBarItem(
		vscode.StatusBarAlignment.Left,
		95
	);
	tokenStatusBar.tooltip = "Tokens that will be copied by Context Craft";
	tokenStatusBar.show();
	tokenStatusBar.text = "$(symbol-string) 0 files | 0 tokens";
	context.subscriptions.push(tokenStatusBar);

	const updateCounts = (filesCount: number, tokensCount: number) => {
		const fileText = `${filesCount} file${filesCount === 1 ? "" : "s"}`;
		const tokenText = `${tokensCount.toLocaleString()} tokens`;
		tokenStatusBar.text = `$(symbol-string) ${fileText} | ${tokenText}`;
		treeView.message = `${fileText} | ${tokenText}`;
	};

	const setCalculating = (hint?: string) => {
		const text = hint ? `Calculating… ${hint}` : "Calculating…";
		tokenStatusBar.text = `$(sync~spin) ${text}`;
		treeView.message = text;
	};

	const setNoWorkspace = () => {
		tokenStatusBar.text = "$(symbol-string) No workspace";
		treeView.message = "No workspace folder";
	};

	return {
		updateCounts,
		setCalculating,
		setNoWorkspace
	};
}
