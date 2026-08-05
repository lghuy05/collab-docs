import type { Slice } from "@tiptap/pm/model";

export type VimMode = "normal" | "insert" | "visual";

export interface VimModeOptions {
  onQuit?: () => void;
}

export interface PendingOp {
  key: "d" | "y";
  expires: number;
}

export interface PendingOpMotion {
  op: "c" | "d" | "y";
  expires: number;
}

export interface PendingMotion {
  key: "g";
  expires: number;
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
  yankSlice: Slice | null;
  pendingOp: PendingOp | null;
  pendingOpMotion: PendingOpMotion | null;
  pendingMotion: PendingMotion | null;
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
