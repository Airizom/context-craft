import * as vscode from "vscode";
import * as path from "path";
import { FileTreeProvider } from "./FileTreeProvider";

export async function toggleSelection(
	target: vscode.Uri,
	isChecked: boolean,
	fileTreeProvider: FileTreeProvider
): Promise<void> {
	const targetPath: string = target.fsPath;
	const startsWithSep: string = targetPath + path.sep;

	if (isChecked) {
		fileTreeProvider.checkedPaths.add(targetPath);

		for (const pathInSet of Array.from(fileTreeProvider.checkedPaths)) {
			if (pathInSet !== targetPath && pathInSet.startsWith(startsWithSep)) {
				fileTreeProvider.checkedPaths.delete(pathInSet);
			}
		}
	} else {
		fileTreeProvider.checkedPaths.delete(targetPath);
		for (const pathInSet of Array.from(fileTreeProvider.checkedPaths)) {
			if (pathInSet.startsWith(startsWithSep)) {
				fileTreeProvider.checkedPaths.delete(pathInSet);
			}
		}
		const selectedAncestors: vscode.Uri[] = findAllSelectedAncestors(target, fileTreeProvider);
		for (const ancestor of selectedAncestors) {
			fileTreeProvider.checkedPaths.delete(ancestor.fsPath);
		}
		if (selectedAncestors.length > 0) {
			const topMost: vscode.Uri = selectedAncestors[selectedAncestors.length - 1];
			await reselectSiblingsExcept(topMost, targetPath, fileTreeProvider);
		}
	}

	await rebalanceParents(target, fileTreeProvider);
}

async function reselectSiblingsExcept(
	parent: vscode.Uri,
	excludedPath: string,
	fileTreeProvider: FileTreeProvider
): Promise<void> {
    const directChildren: vscode.Uri[] = await fileTreeProvider.getChildren(parent);

	for (const child of directChildren) {
		const childPath: string = child.fsPath;

		if (childPath === excludedPath) {
			continue;
		}
        if (excludedPath.startsWith(childPath + path.sep)) {
            await reselectSiblingsExcept(child, excludedPath, fileTreeProvider);
		} else {
			fileTreeProvider.checkedPaths.add(childPath);
		}
	}
}

function findAllSelectedAncestors(descendant: vscode.Uri, fileTreeProvider: FileTreeProvider): vscode.Uri[] {
	const result: vscode.Uri[] = [];
	let cursor: vscode.Uri | undefined = descendant;

	while (cursor !== undefined) {
		const parent: vscode.Uri | undefined =
			path.dirname(cursor.fsPath) === cursor.fsPath ? undefined : vscode.Uri.file(path.dirname(cursor.fsPath));

		if (parent !== undefined && fileTreeProvider.checkedPaths.has(parent.fsPath)) {
			result.push(parent);
		}
		cursor = parent;
	}
	return result;
}

async function rebalanceParents(startLeaf: vscode.Uri, fileTreeProvider: FileTreeProvider): Promise<void> {
    let cursor = (await fileTreeProvider.getParent(startLeaf)) ?? undefined;

    while (cursor !== undefined) {
        const children: vscode.Uri[] = await fileTreeProvider.getChildren(cursor);

		let checkedCount: number = 0;

		for (const child of children) {
			const childPath: string = child.fsPath;
			if (fileTreeProvider.checkedPaths.has(childPath)) {
				checkedCount += 1;
			}
		}

		const parentPath: string = cursor.fsPath;
		if (checkedCount === 0) {
			fileTreeProvider.checkedPaths.delete(parentPath);
		} else if (checkedCount === children.length) {
			fileTreeProvider.checkedPaths.add(parentPath);
		} else {
			fileTreeProvider.checkedPaths.delete(parentPath);
		}

        cursor = (await fileTreeProvider.getParent(cursor)) ?? undefined;
	}
} 