import type { Slice } from "@tiptap/pm/model";

export type VimMode = "normal" | "insert" | "visual" | "visualBlock";

export interface VimModeOptions {
  onQuit?: () => void;
}

export interface PendingFind {
  dir: 1 | -1;
  expires: number;
  type: "f" | "t";
}

export interface LastFind {
  dir: 1 | -1;
  char: string;
  type: "f" | "t";
}

export interface PendingWordOp {
  op: "c" | "d" | "v";
  step: "i" | "w";
  expires: number;
}

export interface PendingReplace {
  expires: number;
}

export interface VimModeStorage {
  enabled: boolean;
  mode: VimMode;
  visualAnchor: number | null;
  visualBlockAnchor: number | null;
  /** Carets used while Ctrl-v I/A inserts the same text across text blocks. */
  visualBlockInsertPositions: number[] | null;
  visualBlockClipboard: string[] | null;
  yankSlice: Slice | null;
  pendingFind: PendingFind | null;
  lastFind: LastFind | null;
  pendingWordOp: PendingWordOp | null;
  pendingReplace: PendingReplace | null;
  pendingCount: string;
  commandActive: boolean;
  commandBuffer: string;
  commandPaletteQuery: string;
  commandSelectionIndex: number | null;
  searchQuery: string;
  searchDirection: 1 | -1;
  searchMatchCount: number;
  searchMatchIndex: number | null;
}
