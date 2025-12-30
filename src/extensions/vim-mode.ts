import { Extension } from "@tiptap/core";
import { Plugin, Selection, TextSelection, Transaction } from "@tiptap/pm/state";
import { Slice, Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

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
}

type VimMode = "normal" | "insert" | "visual";

interface PendingOp {
  key: "d" | "y";
  expires: number;
}

interface PendingOpMotion {
  op: "c" | "d" | "y";
  expires: number;
}

interface PendingMotion {
  key: "g";
  expires: number;
}

interface PendingFind {
  dir: 1 | -1;
  expires: number;
}

interface LastFind {
  dir: 1 | -1;
  char: string;
}

interface PendingWordOp {
  op: "c" | "d" | "v";
  step: "i" | "w";
  expires: number;
}

const printableChars =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}\\|;:'\",.<>?/~`";

const clampPos = (docSize: number, pos: number) => {
  return Math.max(0, Math.min(docSize, pos));
};

const getNormalRange = (doc: Selection["$from"]["doc"], pos: number) => {
  if (doc.content.size === 0) {
    return { from: 0, to: 0 };
  }
  const safePos = clampPos(doc.content.size, pos);
  const $pos = doc.resolve(safePos);

  if ($pos.parent.isTextblock) {
    const start = $pos.start();
    const end = $pos.end();
    if (end <= start) {
      return { from: $pos.pos, to: $pos.pos };
    }
    const clamped = Math.max(start, Math.min(end - 1, safePos));
    return { from: clamped, to: clamped + 1 };
  }

  if (safePos >= doc.content.size) {
    return { from: Math.max(0, doc.content.size - 1), to: doc.content.size };
  }

  return { from: safePos, to: Math.min(safePos + 1, doc.content.size) };
};

const getBasePos = (mode: VimMode, selection: Selection) => {
  if (mode === "normal" && !selection.empty) {
    return selection.from;
  }
  return selection.$head.pos;
};

const clampToTextblock = (
  state: { doc: ProseMirrorNode },
  pos: number,
  referencePos: number
) => {
  if (state.doc.content.size === 0) {
    return 0;
  }
  const $ref = state.doc.resolve(clampPos(state.doc.content.size, referencePos));
  if ($ref.parent.isTextblock) {
    const start = $ref.start();
    const end = $ref.end();
    if (end <= start) {
      return start;
    }
    return Math.max(start, Math.min(end - 1, pos));
  }
  return pos;
};

export const VimModeExtension = Extension.create({
  name: "vimMode",
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
    // Normal mode uses a 1-char selection to emulate a block cursor.
    const setNormalSelectionAt = (pos: number) => {
      const { state, view } = this.editor;
      const { from, to } = getNormalRange(state.doc, pos);
      view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
      return true;
    };

    // Visual mode keeps an anchor and extends the range with movement.
    const setVisualSelectionAt = (pos: number) => {
      const { state, view } = this.editor;
      const anchor = this.storage.visualAnchor ?? state.selection.$head.pos;
      view.dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, anchor, pos))
      );
      return true;
    };

    // Insert mode drops the selection to a caret.
    const enterInsertAt = (pos: number) => {
      const { state, view } = this.editor;
      this.storage.mode = "insert";
      this.storage.visualAnchor = null;
      view.dispatch(
        state.tr.setSelection(
          TextSelection.create(state.doc, clampPos(state.doc.content.size, pos))
        )
      );
      return true;
    };

    const moveBy = (delta: number) => {
      return () => {
        const { state } = this.editor;
        const basePos = getBasePos(this.storage.mode, state.selection);
        const newPos = clampToTextblock(
          state,
          clampPos(state.doc.content.size, basePos + delta),
          basePos
        );

        if (this.storage.mode === "normal") {
          return setNormalSelectionAt(newPos);
        }

        if (this.storage.mode === "visual") {
          return setVisualSelectionAt(newPos);
        }

        return false;
      };
    };

    const moveLine = (dir: number) => {
      return () => {
        const { state, view } = this.editor;
        const basePos = getBasePos(this.storage.mode, state.selection);
        if (state.doc.content.size === 0) {
          if (this.storage.mode === "normal") {
            return setNormalSelectionAt(0);
          }
          if (this.storage.mode === "visual") {
            return setVisualSelectionAt(0);
          }
          return true;
        }
        const start = view.coordsAtPos(basePos);
        if (!start) {
          if (this.storage.mode === "normal") {
            return setNormalSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          if (this.storage.mode === "visual") {
            return setVisualSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          return true;
        }
        const lineHeight = parseInt(getComputedStyle(view.dom).lineHeight) || 20;
        let targetPos: number | null = null;
        for (let step = 1; step <= 6; step += 1) {
          const target = view.posAtCoords({
            left: start.left,
            top: start.top + dir * lineHeight * step,
          });
          if (target && target.pos !== basePos) {
            targetPos = target.pos;
            break;
          }
        }
        if (targetPos == null) {
          if (this.storage.mode === "normal") {
            return setNormalSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          if (this.storage.mode === "visual") {
            return setVisualSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          return true;
        }
        targetPos = clampToTextblock(state, targetPos, targetPos);
        if (this.storage.mode === "normal") {
          return setNormalSelectionAt(targetPos);
        }
        if (this.storage.mode === "visual") {
          return setVisualSelectionAt(targetPos);
        }
        return true;
      };
    };

    const deleteCurrentLine = () => {
      const { state, view } = this.editor;
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      view.dispatch(state.tr.delete(start, end).scrollIntoView());
      this.storage.mode = "normal";
      return true;
    };

    const yankCurrentLine = () => {
      const { state } = this.editor;
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      this.storage.yankSlice = state.doc.slice(start, end);
      return true;
    };

    const pasteAfter = () => {
      const { state, view } = this.editor;
      if (!this.storage.yankSlice) {
        return true;
      }
      const pos = state.selection.$head.pos;
      view.dispatch(
        state.tr.replaceRange(pos, pos, this.storage.yankSlice).scrollIntoView()
      );
      if (this.storage.mode === "normal") {
        return setNormalSelectionAt(pos);
      }
      return true;
    };

    const handlePendingOp = (key: "d" | "y", action: () => boolean) => {
      if (this.storage.mode !== "normal") {
        return false;
      }
      const now = Date.now();
      if (
        this.storage.pendingOp &&
        this.storage.pendingOp.key === key &&
        this.storage.pendingOp.expires > now
      ) {
        this.storage.pendingOp = null;
        return action();
      }
      this.storage.pendingOp = { key, expires: now + 500 };
      return true;
    };

    const handlePendingFindKey = (key: string) => {
      const pending = this.storage.pendingFind;
      if (!pending) {
        return null;
      }
      if (pending.expires < Date.now()) {
        this.storage.pendingFind = null;
        return null;
      }
      if (key.length !== 1) {
        return null;
      }
      this.storage.pendingFind = null;
      return findCharInBlock(pending.dir, key);
    };

    const handlePendingMotion = (key: "g", action: () => boolean) => {
      if (this.storage.mode !== "normal") {
        return false;
      }
      const now = Date.now();
      if (
        this.storage.pendingMotion &&
        this.storage.pendingMotion.key === key &&
        this.storage.pendingMotion.expires > now
      ) {
        this.storage.pendingMotion = null;
        return action();
      }
      this.storage.pendingMotion = { key, expires: now + 500 };
      return true;
    };

    const isWordChar = (value: string) => /[A-Za-z0-9_]/.test(value);

    const findCharInBlock = (
      dir: 1 | -1,
      char: string,
      options: { updateLastFind?: boolean } = {}
    ) => {
      const { state } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);
      const nextIndex =
        dir === 1
          ? text.indexOf(char, offset + 1)
          : text.lastIndexOf(char, Math.max(0, offset - 1));

      if (nextIndex === -1) {
        return true;
      }

      const targetPos = start + nextIndex;
      if (options.updateLastFind !== false) {
        this.storage.lastFind = { dir, char };
      }
      if (this.storage.mode === "visual") {
        return setVisualSelectionAt(targetPos);
      }
      return setNormalSelectionAt(targetPos);
    };

    const moveWordStartNext = () => {
      const { state } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);

      for (let i = offset + 1; i < text.length; i += 1) {
        if (isWordChar(text[i]) && !isWordChar(text[i - 1] || " ")) {
          const targetPos = start + i;
          return this.storage.mode === "visual"
            ? setVisualSelectionAt(targetPos)
            : setNormalSelectionAt(targetPos);
        }
      }
      return true;
    };

    const moveWordEndNext = () => {
      const { state } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);

      let inWord = false;
      for (let i = offset; i < text.length; i += 1) {
        const char = text[i];
        if (isWordChar(char)) {
          inWord = true;
        } else if (inWord) {
          const targetPos = start + Math.max(0, i - 1);
          return this.storage.mode === "visual"
            ? setVisualSelectionAt(targetPos)
            : setNormalSelectionAt(targetPos);
        }
      }

      if (inWord) {
        const targetPos = start + Math.max(0, text.length - 1);
        return this.storage.mode === "visual"
          ? setVisualSelectionAt(targetPos)
          : setNormalSelectionAt(targetPos);
      }

      return true;
    };

    const moveWordStartPrev = () => {
      const { state } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);

      for (let i = Math.min(offset - 1, text.length - 1); i >= 0; i -= 1) {
        if (
          isWordChar(text[i]) &&
          !isWordChar(text[i - 1] || " ")
        ) {
          const targetPos = start + i;
          return this.storage.mode === "visual"
            ? setVisualSelectionAt(targetPos)
            : setNormalSelectionAt(targetPos);
        }
      }
      return true;
    };

    const getWordMotionTarget = (motion: "w" | "e" | "b") => {
      const { state } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      if (!text.length) {
        return null;
      }
      const offset = Math.max(0, Math.min(text.length - 1, basePos - start));

      const findNextWordStart = () => {
        for (let i = offset + 1; i < text.length; i += 1) {
          if (isWordChar(text[i]) && !isWordChar(text[i - 1] || " ")) {
            return i;
          }
        }
        return text.length - 1;
      };

      const findPrevWordStart = () => {
        for (let i = Math.min(offset - 1, text.length - 1); i >= 0; i -= 1) {
          if (isWordChar(text[i]) && !isWordChar(text[i - 1] || " ")) {
            return i;
          }
        }
        return 0;
      };

      const findWordEnd = () => {
        let index = offset;
        if (!isWordChar(text[index])) {
          let found = -1;
          for (let i = index + 1; i < text.length; i += 1) {
            if (isWordChar(text[i])) {
              found = i;
              break;
            }
          }
          if (found === -1) {
            return text.length - 1;
          }
          index = found;
        }
        for (let i = index; i < text.length; i += 1) {
          if (!isWordChar(text[i])) {
            return Math.max(0, i - 1);
          }
        }
        return Math.max(0, text.length - 1);
      };

      const targetIndex =
        motion === "w"
          ? findNextWordStart()
          : motion === "e"
            ? findWordEnd()
            : findPrevWordStart();

      return start + targetIndex;
    };

    const getInnerWordRange = () => {
      const { state } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const maxIndex = text.length - 1;
      if (maxIndex < 0) {
        return null;
      }

      let index = Math.max(0, Math.min(maxIndex, basePos - start));
      if (!isWordChar(text[index])) {
        let found = -1;
        for (let i = index + 1; i < text.length; i += 1) {
          if (isWordChar(text[i])) {
            found = i;
            break;
          }
        }
        if (found === -1) {
          return null;
        }
        index = found;
      }

      let wordStart = index;
      while (wordStart > 0 && isWordChar(text[wordStart - 1])) {
        wordStart -= 1;
      }
      let wordEnd = index + 1;
      while (wordEnd < text.length && isWordChar(text[wordEnd])) {
        wordEnd += 1;
      }

      return { from: start + wordStart, to: start + wordEnd };
    };

    const handlePendingWordKey = (key: string) => {
      const pending = this.storage.pendingWordOp;
      if (!pending) {
        return null;
      }
      if (pending.expires < Date.now()) {
        this.storage.pendingWordOp = null;
        return null;
      }
      if (pending.step === "i") {
        if (key === "i") {
          this.storage.pendingWordOp = {
            op: pending.op,
            step: "w",
            expires: Date.now() + 800,
          };
          return true;
        }
        this.storage.pendingWordOp = null;
        return null;
      }
      if (pending.step === "w") {
        if (key !== "w") {
          this.storage.pendingWordOp = null;
          return null;
        }
        this.storage.pendingWordOp = null;
        const range = getInnerWordRange();
        if (!range) {
          return true;
        }
        if (pending.op === "v") {
          this.storage.mode = "visual";
          this.storage.visualAnchor = range.from;
          const { state, view } = this.editor;
          view.dispatch(
            state.tr.setSelection(
              TextSelection.create(state.doc, range.from, range.to)
            )
          );
          return true;
        }
        const { state, view } = this.editor;
        const tr = state.tr.delete(range.from, range.to);
        view.dispatch(tr.scrollIntoView());
        if (pending.op === "c") {
          return enterInsertAt(range.from);
        }
        return setNormalSelectionAt(range.from);
      }
      return null;
    };

    // Pending op/motion handlers emulate multi-key Vim commands like dw/ye.
    const applyOpMotion = (op: "c" | "d" | "y", motion: "w" | "e" | "b") => {
      const { state, view } = this.editor;
      const basePos = getBasePos(this.storage.mode, state.selection);
      const targetPos = getWordMotionTarget(motion);
      if (targetPos == null) {
        return true;
      }

      let from = basePos;
      let to = targetPos;
      if (motion === "b") {
        from = targetPos;
        to = basePos + 1;
      } else if (motion === "e") {
        to = targetPos + 1;
      }

      const clampedFrom = clampPos(state.doc.content.size, from);
      const clampedTo = clampPos(state.doc.content.size, to);
      const rangeFrom = Math.min(clampedFrom, clampedTo);
      const rangeTo = Math.max(clampedFrom, clampedTo);

      if (op === "y") {
        this.storage.yankSlice = state.doc.slice(rangeFrom, rangeTo);
        return setNormalSelectionAt(rangeFrom);
      }

      const tr = state.tr.delete(rangeFrom, rangeTo);
      view.dispatch(tr.scrollIntoView());
      if (op === "c") {
        return enterInsertAt(rangeFrom);
      }
      return setNormalSelectionAt(rangeFrom);
    };

    const handlePendingOpMotionKey = (key: string) => {
      const pending = this.storage.pendingOpMotion;
      if (!pending) {
        return null;
      }
      if (pending.expires < Date.now()) {
        this.storage.pendingOpMotion = null;
        return null;
      }
      if (key === "w" || key === "e" || key === "b") {
        this.storage.pendingOpMotion = null;
        this.storage.pendingWordOp = null;
        return applyOpMotion(pending.op, key);
      }
      this.storage.pendingOpMotion = null;
      return null;
    };

    const yankSelection = () => {
      const { state, view } = this.editor;
      if (state.selection.empty) {
        return true;
      }
      this.storage.yankSlice = state.selection.content();
      this.storage.mode = "normal";
      this.storage.visualAnchor = null;
      const pos = state.selection.from;
      const { from, to } = getNormalRange(state.doc, pos);
      view.dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, from, to))
      );
      return true;
    };

    const withFind = (key: string, handler: () => boolean) => {
      return () => {
        if (!this.storage.enabled) {
          return false;
        }
        const pendingOpMotion = handlePendingOpMotionKey(key);
        if (pendingOpMotion !== null) {
          return pendingOpMotion;
        }
        const pendingWord = handlePendingWordKey(key);
        if (pendingWord !== null) {
          return pendingWord;
        }
        const pending = handlePendingFindKey(key);
        if (pending !== null) {
          return pending;
        }
        return handler();
      };
    };

    const withEnabled = (handler: () => boolean) => {
      return () => {
        if (!this.storage.enabled) {
          return false;
        }
        return handler();
      };
    };

    const shortcuts: Record<string, (props?: unknown) => boolean> = {
      Escape: withEnabled(() => {
        this.editor.commands.enterNormalMode();
        return true;
      }),
      "Mod-c": withEnabled(() => {
        this.editor.commands.enterNormalMode();
        return true;
      }),
      i: withFind("i", () => {
        if (this.storage.mode === "visual") {
          this.storage.pendingWordOp = {
            op: "v",
            step: "w",
            expires: Date.now() + 800,
          };
          return true;
        }
        if (this.storage.mode !== "normal") {
          return false;
        }
        const { state } = this.editor;
        return enterInsertAt(getBasePos(this.storage.mode, state.selection));
      }),
      a: withFind("a", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        const { state } = this.editor;
        return enterInsertAt(
          clampPos(
            state.doc.content.size,
            state.selection.from + (state.selection.empty ? 0 : 1)
          )
        );
      }),
      I: withFind("I", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        const { state } = this.editor;
        const { $head } = state.selection;
        return enterInsertAt($head.start($head.depth));
      }),
      A: withFind("A", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        const { state } = this.editor;
        const { $head } = state.selection;
        return enterInsertAt($head.end($head.depth));
      }),
      o: withFind("o", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        const { state, view } = this.editor;
        const { $head } = state.selection;
        const insertPos = $head.end($head.depth);
        this.storage.mode = "insert";
        this.storage.visualAnchor = null;
        let tr = state.tr.setSelection(
          TextSelection.create(state.doc, insertPos)
        );
        tr = tr.split(insertPos);
        const mappedPos = tr.mapping.map(insertPos + 1);
        tr = tr.setSelection(TextSelection.create(tr.doc, mappedPos));
        view.dispatch(tr.scrollIntoView());
        return true;
      }),
      v: withFind("v", () => {
        if (this.storage.mode !== "visual") {
          this.editor.commands.enterVisualMode();
          this.storage.pendingWordOp = {
            op: "v",
            step: "i",
            expires: Date.now() + 800,
          };
          return true;
        }
        this.editor.commands.enterNormalMode();
        return true;
      }),
      V: withFind("V", () => {
        if (this.storage.mode !== "visual") {
          const { state, view } = this.editor;
          const { $head } = state.selection;
          const start = $head.start($head.depth);
          const end = $head.end($head.depth);
          this.storage.mode = "visual";
          this.storage.visualAnchor = start;
          view.dispatch(
            state.tr.setSelection(TextSelection.create(state.doc, start, end))
          );
          return true;
        }
        this.editor.commands.enterNormalMode();
        return true;
      }),
      h: withFind("h", () =>
        this.storage.mode === "insert" ? false : moveBy(-1)()
      ),
      l: withFind("l", () =>
        this.storage.mode === "insert" ? false : moveBy(1)()
      ),
      j: withFind("j", () =>
        this.storage.mode === "insert" ? false : moveLine(1)()
      ),
      k: withFind("k", () =>
        this.storage.mode === "insert" ? false : moveLine(-1)()
      ),
      c: withFind("c", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        this.storage.pendingOpMotion = {
          op: "c",
          expires: Date.now() + 800,
        };
        this.storage.pendingWordOp = {
          op: "c",
          step: "i",
          expires: Date.now() + 800,
        };
        return true;
      }),
      d: withFind("d", () => {
        if (this.storage.mode === "visual") {
          const { state, view } = this.editor;
          view.dispatch(state.tr.deleteSelection().scrollIntoView());
          this.editor.commands.enterNormalMode();
          return true;
        }
        if (this.storage.mode !== "normal") {
          return false;
        }
        this.storage.pendingOpMotion = {
          op: "d",
          expires: Date.now() + 800,
        };
        this.storage.pendingWordOp = {
          op: "d",
          step: "i",
          expires: Date.now() + 800,
        };
        return handlePendingOp("d", deleteCurrentLine);
      }),
      y: withFind("y", () => {
        if (this.storage.mode === "visual") {
          return yankSelection();
        }
        if (this.storage.mode === "normal") {
          this.storage.pendingOpMotion = {
            op: "y",
            expires: Date.now() + 800,
          };
        }
        return handlePendingOp("y", yankCurrentLine);
      }),
      p: withFind("p", () =>
        this.storage.mode === "insert" ? false : pasteAfter()
      ),
      f: withFind("f", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        this.storage.pendingFind = { dir: 1, expires: Date.now() + 1500 };
        return true;
      }),
      F: withFind("F", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        this.storage.pendingFind = { dir: -1, expires: Date.now() + 1500 };
        return true;
      }),
      ";": withFind(";", () => {
        if (!this.storage.lastFind || this.storage.mode === "insert") {
          return false;
        }
        return findCharInBlock(this.storage.lastFind.dir, this.storage.lastFind.char, {
          updateLastFind: false,
        });
      }),
      ",": withFind(",", () => {
        if (!this.storage.lastFind || this.storage.mode === "insert") {
          return false;
        }
        return findCharInBlock(
          (this.storage.lastFind.dir * -1) as 1 | -1,
          this.storage.lastFind.char,
          { updateLastFind: false }
        );
      }),
      g: withFind("g", () =>
        handlePendingMotion("g", () => setNormalSelectionAt(0))
      ),
      G: withFind("G", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        const { state } = this.editor;
        return setNormalSelectionAt(state.doc.content.size);
      }),
      w: withFind("w", () =>
        this.storage.mode === "insert" ? false : moveWordStartNext()
      ),
      e: withFind("e", () =>
        this.storage.mode === "insert" ? false : moveWordEndNext()
      ),
      b: withFind("b", () =>
        this.storage.mode === "insert" ? false : moveWordStartPrev()
      ),
      u: withFind("u", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        if (this.editor.commands.undo) {
          this.editor.commands.undo();
          return true;
        }
        return false;
      }),
      "Mod-r": withFind("Mod-r", () => {
        if (this.storage.mode !== "normal") {
          return false;
        }
        if (this.editor.commands.redo) {
          this.editor.commands.redo();
          return true;
        }
        return false;
      }),
    };

    for (const char of printableChars) {
      if (!shortcuts[char]) {
        shortcuts[char] = withFind(char, () => this.storage.mode !== "insert");
      }
    }

    return shortcuts;
  },
  addProseMirrorPlugins() {
    const updateClasses = (element: HTMLElement) => {
      if (!this.storage.enabled) {
        element.classList.remove("vim-normal-mode", "vim-visual-mode", "vim-insert-mode");
        element.removeAttribute("data-vim-mode");
        return;
      }
      element.classList.toggle("vim-normal-mode", this.storage.mode === "normal");
      element.classList.toggle("vim-visual-mode", this.storage.mode === "visual");
      element.classList.toggle("vim-insert-mode", this.storage.mode === "insert");
      element.setAttribute("data-vim-mode", this.storage.mode);
    };

    return [
      new Plugin({
        view: (view) => {
          updateClasses(view.dom as HTMLElement);
          return {
            update: (view) => {
              updateClasses(view.dom as HTMLElement);
              if (!this.storage.enabled) {
                return;
              }
              // Keep the block cursor visible when ProseMirror collapses the selection.
              if (this.storage.mode === "normal" && view.state.selection.empty) {
                const pos = view.state.selection.from;
                const { from, to } = getNormalRange(view.state.doc, pos);
                if (
                  from !== view.state.selection.from ||
                  to !== view.state.selection.to
                ) {
                  view.dispatch(
                    view.state.tr.setSelection(
                      TextSelection.create(view.state.doc, from, to)
                    )
                  );
                }
              }
              if (
                this.storage.mode === "normal" &&
                view.state.doc.content.size === 0 &&
                view.state.selection.empty
              ) {
                view.dispatch(
                  view.state.tr.setSelection(
                    TextSelection.create(view.state.doc, 0, 0)
                  )
                );
              }
            },
            destroy: () => {
              const element = view.dom as HTMLElement;
              element.classList.remove("vim-normal-mode", "vim-visual-mode");
              element.classList.remove("vim-insert-mode");
              element.removeAttribute("data-vim-mode");
            },
          };
        },
        handleTextInput: () => {
          return this.storage.enabled && this.storage.mode !== "insert";
        },
      }),
      new Plugin({
        props: {
          decorations: (state) => {
            if (!this.storage.enabled) {
              return null;
            }
            if (this.storage.mode !== "normal") {
              return null;
            }
            if (!state.selection.empty) {
              return null;
            }
            const $head = state.selection.$head;
            if (!$head.parent.isTextblock) {
              return null;
            }
            if ($head.parent.content.size > 0) {
              return null;
            }
            const widget = Decoration.widget(state.selection.from, () => {
              const span = document.createElement("span");
              span.className = "vim-block-cursor";
              return span;
            });
            return DecorationSet.create(state.doc, [widget]);
          },
        },
      }),
    ];
  },
});
