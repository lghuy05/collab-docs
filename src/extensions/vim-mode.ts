import { Extension } from "@tiptap/core";
import { Selection, TextSelection, Transaction } from "@tiptap/pm/state";
import { Slice } from "@tiptap/pm/model";
import { createVimKeyboardShortcuts } from "./vim/keybindings";
import { createVimPlugins } from "./vim/plugins";
import type {
  LastFind,
  PendingFind,
  PendingMotion,
  PendingOp,
  PendingOpMotion,
  PendingWordOp,
  VimMode,
  VimModeOptions,
} from "./vim/types";
import { getNormalRange } from "./vim/utils";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    vimMode: {
      enterNormalMode: () => ReturnType;
      enterInsertMode: () => ReturnType;
      enterVisualMode: () => ReturnType;
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
      yankSlice: Slice | null;
      pendingOp: PendingOp | null;
      pendingOpMotion: PendingOpMotion | null;
      pendingMotion: PendingMotion | null;
      pendingFind: PendingFind | null;
      lastFind: LastFind | null;
      pendingWordOp: PendingWordOp | null;
      commandActive: boolean;
      commandBuffer: string;
      searchQuery: string;
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
      yankSlice: null as Slice | null,
      pendingOp: null as PendingOp | null,
      pendingOpMotion: null as PendingOpMotion | null,
      pendingMotion: null as PendingMotion | null,
      pendingFind: null as PendingFind | null,
      lastFind: null as LastFind | null,
      pendingWordOp: null as PendingWordOp | null,
      commandActive: false,
      commandBuffer: "",
      searchQuery: "",
    };
  },
  addCommands() {
    const resetTransientState = () => {
      this.storage.visualAnchor = null;
      this.storage.pendingOp = null;
      this.storage.pendingOpMotion = null;
      this.storage.pendingMotion = null;
      this.storage.pendingFind = null;
      this.storage.lastFind = null;
      this.storage.pendingWordOp = null;
      this.storage.commandActive = false;
      this.storage.commandBuffer = "";
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
          const basePos = Math.max(0, tr.selection.$head.pos - 1);
          const { from, to } = getNormalRange(tr.doc, basePos);
          dispatch(tr.setSelection(TextSelection.create(tr.doc, from, to)));
        }
        return true;
      },
      enterInsertMode: () => ({ tr, dispatch }) => {
        this.storage.mode = "insert";
        this.storage.visualAnchor = null;
        if (dispatch) {
          const pos = tr.selection.$head.pos;
          dispatch(tr.setSelection(TextSelection.create(tr.doc, pos)));
        }
        return true;
      },
      enterVisualMode: () => ({ tr, dispatch }) => {
        this.storage.mode = "visual";
        const pos = tr.selection.$head.pos;
        this.storage.visualAnchor = pos;
        if (dispatch) {
          dispatch(tr.setSelection(TextSelection.create(tr.doc, pos, pos)));
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
