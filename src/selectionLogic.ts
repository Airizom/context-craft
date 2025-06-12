import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";

/**
 * Toggle the selection state for the given target path.
 *
 * Rules (two-state only – Checked / Unchecked):
 * 1. When a path is checked we:
 *    • Add it to the selected set.
 *    • Remove every descendant path from the set (they are now redundant).
 *    • Remove every ancestor path from the set (to avoid duplicates – the current path already covers them).
 * 2. When a path is unchecked we:
 *    • Remove it from the selected set (if present).
 *    • Remove every descendant path from the set (they are implicitly unchecked too).
 *    • Ancestors are not modified; they remain unselected because rule 1 always removes them when a descendant is selected.
 */
export async function toggleSelection(
	target: vscode.Uri,
	isChecked: boolean,
	fileTreeProvider: FileTreeProvider
): Promise<void> {
	const targetPath = target.fsPath;
	const withSep = targetPath + path.sep;

	if (isChecked) {
		// 1. Add the target itself.
		fileTreeProvider.checkedPaths.add(targetPath);

		// 2. Drop descendants (e.g. previously individually-selected files under this folder).
		for (const p of Array.from(fileTreeProvider.checkedPaths)) {
			if (p !== targetPath && p.startsWith(withSep)) {
				fileTreeProvider.checkedPaths.delete(p);
			}
		}

		// 3. Drop any ancestor selections – they're redundant now that the child is selected.
		let parentDir = path.dirname(targetPath);
		while (parentDir !== targetPath) {
			fileTreeProvider.checkedPaths.delete(parentDir);
			const nextParent = path.dirname(parentDir);
			if (nextParent === parentDir) {
				break; // reached filesystem root
			}
			parentDir = nextParent;
		}
	} else {
		// Uncheck → remove the path and all of its descendants.
		fileTreeProvider.checkedPaths.delete(targetPath);
		for (const p of Array.from(fileTreeProvider.checkedPaths)) {
			if (p.startsWith(withSep)) {
				fileTreeProvider.checkedPaths.delete(p);
			}
		}
	}
} 