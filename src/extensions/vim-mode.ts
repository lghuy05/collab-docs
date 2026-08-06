import { Extension } from "@tiptap/core";
import { Selection, TextSelection, Transaction } from "@tiptap/pm/state";
import { Slice } from "@tiptap/pm/model";
import { createVimKeyboardShortcuts } from "./vim/keybindings";
import { vimEnginePluginKey } from "./vim/engine/state";
import { createVimPlugins } from "./vim/plugins";
import type {
  LastFind,
  PendingFind,
  PendingReplace,
  PendingWordOp,
  VimMode,
  VimModeOptions,
} from "./vim/types";
import { getNormalCursorPos, getNormalRange } from "./vim/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    vimMode: {
      enterNormalMode: () => ReturnType;
      enterInsertMode: () => ReturnType;
      enterVisualMode: () => ReturnType;
      enterVisualBlockMode: () => ReturnType;
      enableVimMode: () => ReturnType;
      disableVimMode: () => ReturnType;
      toggleVimMode: () => ReturnType;
    };
  }

  interface Storage {
    vimMode: {
      enabled: boolean;
      mode: VimMode;
      visualAnchor: number | null;
      visualBlockAnchor: number | null;
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
    };
  }
}

export const VimModeExtension = Extension.create<VimModeOptions>({
  name: "vimMode",
  addOptions() {
    return {
      onQuit: undefined,
    };
  },
  addStorage() {
    return {
      enabled: true,
      mode: "insert" as VimMode,
      visualAnchor: null as number | null,
      visualBlockAnchor: null as number | null,
      visualBlockInsertPositions: null as number[] | null,
      visualBlockClipboard: null as string[] | null,
      yankSlice: null as Slice | null,
      pendingFind: null as PendingFind | null,
      lastFind: null as LastFind | null,
      pendingWordOp: null as PendingWordOp | null,
      pendingReplace: null as PendingReplace | null,
      pendingCount: "",
      commandActive: false,
      commandBuffer: "",
      commandPaletteQuery: "",
      commandSelectionIndex: null,
      searchQuery: "",
      searchDirection: 1,
      searchMatchCount: 0,
      searchMatchIndex: null,
    };
  },
  addCommands() {
    const resetTransientState = () => {
      this.storage.visualAnchor = null;
      this.storage.visualBlockAnchor = null;
      this.storage.visualBlockInsertPositions = null;
      this.storage.pendingFind = null;
      this.storage.lastFind = null;
      this.storage.pendingWordOp = null;
      this.storage.pendingReplace = null;
      this.storage.pendingCount = "";
      this.storage.commandActive = false;
      this.storage.commandBuffer = "";
      this.storage.commandPaletteQuery = "";
      this.storage.commandSelectionIndex = null;
    };

    const setCaretSelection = (tr: Transaction, dispatch?: (tr: Transaction) => void) => {
      if (!dispatch) {
        return;
      }
      const pos = tr.selection.$head.pos;
      dispatch(tr.setSelection(TextSelection.create(tr.doc, pos)));
    };

    return {
      enterNormalMode: () => ({ tr, dispatch }) => {
        if (dispatch) {
          this.storage.mode = "normal";
          this.storage.visualAnchor = null;
          this.storage.visualBlockAnchor = null;
          this.storage.visualBlockInsertPositions = null;
          const basePos = getNormalCursorPos(tr.doc, tr.selection.$head.pos);
          const { from, to } = getNormalRange(tr.doc, basePos);
          dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, from, to))
              .setMeta(vimEnginePluginKey, { mode: "normal", pendingTokens: [], visualAnchor: null })
          );
        }
        return true;
      },
      enterInsertMode: () => ({ tr, dispatch }) => {
        this.storage.mode = "insert";
        this.storage.visualAnchor = null;
        this.storage.visualBlockAnchor = null;
        this.storage.visualBlockInsertPositions = null;
        if (dispatch) {
          const pos = tr.selection.$head.pos;
          dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, pos))
              .setMeta(vimEnginePluginKey, { mode: "insert", pendingTokens: [], visualAnchor: null })
          );
        }
        return true;
      },
      enterVisualMode: () => ({ tr, dispatch }) => {
        this.storage.mode = "visual";
        const pos = tr.selection.$head.pos;
        this.storage.visualAnchor = pos;
        if (dispatch) {
          dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, pos, pos))
              .setMeta(vimEnginePluginKey, { mode: "visual", pendingTokens: [], visualAnchor: pos })
          );
        }
        return true;
      },
      enterVisualBlockMode: () => ({ tr, dispatch }) => {
        this.storage.mode = "visualBlock";
        const pos = tr.selection.$head.pos;
        this.storage.visualAnchor = null;
        this.storage.visualBlockAnchor = pos;
        this.storage.visualBlockInsertPositions = null;
        if (dispatch) {
          dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, pos, pos))
              .setMeta(vimEnginePluginKey, { mode: "visualBlock", pendingTokens: [], visualAnchor: pos })
          );
        }
        return true;
      },
      enableVimMode: () => ({ tr, dispatch }) => {
        this.storage.enabled = true;
        this.storage.mode = "insert";
        resetTransientState();
        setCaretSelection(tr, dispatch);
        return true;
      },
      disableVimMode: () => ({ tr, dispatch }) => {
        this.storage.enabled = false;
        this.storage.mode = "insert";
        resetTransientState();
        setCaretSelection(tr, dispatch);
        return true;
      },
      toggleVimMode: () => ({ tr, dispatch }) => {
        this.storage.enabled = !this.storage.enabled;
        this.storage.mode = "insert";
        resetTransientState();
        setCaretSelection(tr, dispatch);
        return true;
      },
    };
  },
  addKeyboardShortcuts() {
    return createVimKeyboardShortcuts({
      editor: this.editor,
      options: this.options,
      storage: this.storage,
    });
  },
  addProseMirrorPlugins() {
    return createVimPlugins(this.storage);
  },
});
