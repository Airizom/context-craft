import * as vscode from "vscode";
import { debounce } from "../utils/debounce";
import { FileTreeProvider } from "../tree/FileTreeProvider";
import type { StatusUi } from "./statusUi";

export interface RefreshController {
	refreshAndUpdate: () => Promise<void>;
	debouncedRefreshAndUpdate: () => void;
	handleWorkspaceFoldersChanged: () => Promise<void>;
}

export interface RefreshControllerOptions {
	fileTreeProvider: FileTreeProvider;
	resolveSelectedFiles: (fileTree: FileTreeProvider, root?: vscode.Uri, signal?: AbortSignal) => Promise<string[]>;
	countTokens: (paths: string[], signal?: AbortSignal) => Promise<number>;
	statusUi: StatusUi;
	pruneSelectionsOutsideWorkspace: (fileTreeProvider: FileTreeProvider) => boolean;
	persistSelections: () => Promise<void>;
}

export function createRefreshController(options: RefreshControllerOptions): RefreshController {
	const {
		fileTreeProvider,
		resolveSelectedFiles,
		countTokens,
		statusUi,
		pruneSelectionsOutsideWorkspace,
		persistSelections
	} = options;

	let currentAbort: AbortController | undefined;
	let refreshSeq = 0;

	const refreshAndUpdate = async () => {
		const mySeq = ++refreshSeq;
		try {
			currentAbort?.abort();
		} catch {}
		currentAbort = new AbortController();
		fileTreeProvider.refresh();
		const hasWorkspace = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
		if (!hasWorkspace) {
			statusUi.setNoWorkspace();
			return;
		}

		const checkedCount = fileTreeProvider.checkedPaths.size;
		console.log(`[ContextCraft] refresh start seq=${mySeq} checked=${checkedCount}`);
		statusUi.setCalculating(checkedCount > 0 ? `${checkedCount} selected` : undefined);
		const t0 = Date.now();
		const resolvedFiles = await resolveSelectedFiles(fileTreeProvider, undefined, currentAbort.signal);
		if (mySeq !== refreshSeq) {
			return;
		}
		const t1 = Date.now();
		console.log(`[ContextCraft] resolveSelectedFiles seq=${mySeq} files=${resolvedFiles.length} in ${t1 - t0}ms`);
		const filesCount = resolvedFiles.length;
		const t2 = Date.now();
		const tokens = await countTokens(resolvedFiles, currentAbort.signal);
		if (mySeq !== refreshSeq) {
			return;
		}
		const t3 = Date.now();
		console.log(`[ContextCraft] countTokens seq=${mySeq} totalTokens=${tokens} in ${t3 - t2}ms (total ${t3 - t0}ms)`);
		statusUi.updateCounts(filesCount, tokens);
	};

	const debouncedRefreshAndUpdate = debounce(refreshAndUpdate, 200);

	const handleWorkspaceFoldersChanged = async () => {
		console.log("[ContextCraft] Workspace folders changed, pruning selections and refreshing tree");
		const selectionsPruned = pruneSelectionsOutsideWorkspace(fileTreeProvider);
		if (selectionsPruned) {
			await persistSelections();
		}
		debouncedRefreshAndUpdate();
	};

	return {
		refreshAndUpdate,
		debouncedRefreshAndUpdate,
		handleWorkspaceFoldersChanged
	};
}
