export const STATE_KEY_SELECTED = "contextCraft.selectedPaths";
export const MAX_PREVIEW_BYTES = 200_000;

// Safety caps to avoid OOM when traversing very large folders
// Applies to total file paths collected across the current selection run
export const MAX_COLLECTED_FILES = 10000;
