import * as vscode from "vscode";
import { registerCopySelectedCommand } from "./copySelected";
import { registerRefreshCommand } from "./refresh";
import { registerUnselectAllCommand } from "./unselectAll";
import { registerSelectGitChangesCommand } from "./selectGitChanges";
import { registerSelectOpenEditorsCommand } from "./selectOpenEditors";
import { registerOpenFileCommand } from "./openFile";
import { registerOpenToSideCommand } from "./openToSide";
import { registerRevealInOSCommand } from "./revealInOS";
import { registerOpenInTerminalCommand } from "./openInTerminal";
import { registerCopyPathCommand } from "./copyPath";
import { registerCopyRelativePathCommand } from "./copyRelativePath";
import { registerRenameFileCommand } from "./renameFile";
import { registerDeleteFileCommand } from "./deleteFile";
import { FileTreeProvider } from "../tree/FileTreeProvider";

export interface CommandDependencies {
	fileTreeProvider: FileTreeProvider;
	resolveSelectedFiles: (fileTree: FileTreeProvider, root?: vscode.Uri, signal?: AbortSignal) => Promise<string[]>;
	refresh: () => void;
}

export function registerCommands(
	context: vscode.ExtensionContext,
	deps: CommandDependencies
): void {
	const { fileTreeProvider, resolveSelectedFiles, refresh } = deps;

	registerUnselectAllCommand(context, fileTreeProvider, refresh);
	registerSelectGitChangesCommand(context, fileTreeProvider, refresh);
	registerSelectOpenEditorsCommand(context, fileTreeProvider, refresh);
	registerCopySelectedCommand(context, fileTreeProvider, resolveSelectedFiles);
	registerRefreshCommand(context, fileTreeProvider, refresh);
	registerOpenFileCommand(context);
	registerOpenToSideCommand(context);
	registerRevealInOSCommand(context);
	registerOpenInTerminalCommand(context);
	registerCopyPathCommand(context);
	registerCopyRelativePathCommand(context);
	registerRenameFileCommand(context, fileTreeProvider, refresh);
	registerDeleteFileCommand(context, fileTreeProvider, refresh);
}
