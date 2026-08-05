import type { Editor } from "@tiptap/core";
import { Selection, TextSelection } from "@tiptap/pm/state";
import { canSplit } from "@tiptap/pm/transform";

import { getVimCommandSuggestions } from "./command-registry";
import { visualFormattingDefinitions } from "./engine/default-definitions";
import { consumeVimEngineInput } from "./engine/input";
import type { ParsedVimCommand } from "./engine/grammar";
import { vimEnginePluginKey } from "./engine/state";
import { executeVimCommand } from "./ex-commands";
import type { VimModeOptions, VimModeStorage } from "./types";
import {
  clampPos,
  clampToTextblock,
  getBasePos,
  getFirstTextblockPos,
  getNormalCursorPos,
  getNormalRange,
  printableChars,
  updateCommandAttributes,
} from "./utils";

export interface VimKeyboardContext {
  editor: Editor;
  options: VimModeOptions;
  storage: VimModeStorage;
}

/**
 * The modal input engine. It preserves the existing key behavior while
 * keeping keyboard parsing separate from the Tiptap extension lifecycle.
 */
export const createVimKeyboardShortcuts = (context: VimKeyboardContext) => {
    const takeCount = () => {
      const count = Number(context.storage.pendingCount) || 1;
      context.storage.pendingCount = "";
      return count;
    };

    const appendCount = (digit: string) => {
      if (
        !context.storage.enabled ||
        context.storage.commandActive ||
        context.storage.mode === "insert"
      ) {
        return false;
      }
      context.storage.pendingCount += digit;
      return true;
    };

    const repeatMotion = (motion: () => boolean) => {
      const count = takeCount();
      let handled = true;
      for (let index = 0; index < count; index += 1) {
        handled = motion();
        if (!handled) {
          break;
        }
      }
      return handled;
    };

    // Normal mode uses a 1-char selection to emulate a block cursor.
    const setNormalSelectionAt = (pos: number) => {
      const { state, view } = context.editor;
      const { from, to } = getNormalRange(state.doc, pos);
      view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from, to)));
      return true;
    };

    // Visual mode keeps an anchor and extends the range with movement.
    const setVisualSelectionAt = (pos: number) => {
      const { state, view } = context.editor;
      const anchor = vimEnginePluginKey.getState(state)?.visualAnchor
        ?? context.storage.visualAnchor
        ?? state.selection.$head.pos;
      view.dispatch(
        state.tr
          .setSelection(TextSelection.create(state.doc, anchor, pos))
          .setMeta(vimEnginePluginKey, { mode: "visual", visualAnchor: anchor })
      );
      return true;
    };

    // Insert mode drops the selection to a caret.
    const enterInsertAt = (pos: number) => {
      const { state, view } = context.editor;
      context.storage.mode = "insert";
      context.storage.visualAnchor = null;
      view.dispatch(
        state.tr
          .setSelection(
            TextSelection.create(state.doc, clampPos(state.doc.content.size, pos))
          )
          .setMeta(vimEnginePluginKey, {
            mode: "insert",
            pendingTokens: [],
            visualAnchor: null,
          })
      );
      return true;
    };

    const moveBy = (delta: number) => {
      return () => {
        const { state } = context.editor;
        const basePos = getBasePos(context.storage.mode, state.selection);
        const newPos = clampToTextblock(
          state,
          clampPos(state.doc.content.size, basePos + delta),
          basePos
        );

        if (context.storage.mode === "normal") {
          return setNormalSelectionAt(newPos);
        }

        if (context.storage.mode === "visual") {
          return setVisualSelectionAt(newPos);
        }

        return false;
      };
    };

    const moveLine = (dir: number) => {
      return () => {
        const { state, view } = context.editor;
        const basePos = getBasePos(context.storage.mode, state.selection);
        const getAdjacentTextblockPos = () => {
          const baseBlockPos = state.selection.$head.before(state.selection.$head.depth);
          let previous: number | null = null;
          let next: number | null = null;
          state.doc.descendants((node, pos) => {
            if (!node.isTextblock) {
              return;
            }
            if (pos < baseBlockPos) {
              previous = pos + 1;
            } else if (pos > baseBlockPos && next == null) {
              next = pos + 1;
            }
          });
          return dir < 0 ? previous : next;
        };
        if (state.doc.content.size === 0) {
          if (context.storage.mode === "normal") {
            return setNormalSelectionAt(0);
          }
          if (context.storage.mode === "visual") {
            return setVisualSelectionAt(0);
          }
          return true;
        }
        const start = view.coordsAtPos(basePos);
        if (!start) {
          if (context.storage.mode === "normal") {
            return setNormalSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          if (context.storage.mode === "visual") {
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
          if (context.storage.mode === "normal") {
            return setNormalSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          if (context.storage.mode === "visual") {
            return setVisualSelectionAt(
              clampToTextblock(state, basePos, basePos)
            );
          }
          return true;
        }
        const $target = state.doc.resolve(
          clampPos(state.doc.content.size, targetPos)
        );
        if ($target.parent.isTextblock) {
          targetPos = clampToTextblock(state, targetPos, targetPos);
        } else {
          targetPos = getAdjacentTextblockPos() ?? clampToTextblock(state, basePos, basePos);
        }
        if (context.storage.mode === "normal") {
          return setNormalSelectionAt(targetPos);
        }
        if (context.storage.mode === "visual") {
          return setVisualSelectionAt(targetPos);
        }
        return true;
      };
    };

    const deleteCurrentLine = () => {
      const { state, view } = context.editor;
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      if (start === end) {
        const blockStart = $head.before($head.depth);
        const blockEnd = $head.after($head.depth);
        let textblockCount = 0;
        state.doc.descendants((node) => {
          if (node.isTextblock) {
            textblockCount += 1;
          }
        });
        // A ProseMirror document must retain one valid text block, but an
        // empty line between (or beside) other blocks should disappear on dd.
        if (textblockCount > 1) {
          const tr = state.tr.delete(blockStart, blockEnd);
          const cursor = getNormalCursorPos(
            tr.doc,
            Math.min(blockStart, tr.doc.content.size)
          );
          const range = getNormalRange(tr.doc, cursor);
          view.dispatch(
            tr
              .setSelection(TextSelection.create(tr.doc, range.from, range.to))
              .scrollIntoView()
          );
          context.storage.mode = "normal";
          return true;
        }
      }
      view.dispatch(state.tr.delete(start, end).scrollIntoView());
      context.storage.mode = "normal";
      return true;
    };

    const yankCurrentLine = () => {
      const { state } = context.editor;
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      context.storage.yankSlice = state.doc.slice(start, end);
      return true;
    };

    const pasteAfter = () => {
      const { state, view } = context.editor;
      if (!context.storage.yankSlice) {
        return true;
      }
      const pos = state.selection.$head.pos;
      view.dispatch(
        state.tr.replaceRange(pos, pos, context.storage.yankSlice).scrollIntoView()
      );
      if (context.storage.mode === "normal") {
        return setNormalSelectionAt(pos);
      }
      return true;
    };

    const pasteBefore = () => {
      const { state, view } = context.editor;
      if (!context.storage.yankSlice) {
        return true;
      }
      const pos = state.selection.from;
      view.dispatch(
        state.tr.replaceRange(pos, pos, context.storage.yankSlice).scrollIntoView()
      );
      return context.storage.mode === "normal" ? setNormalSelectionAt(pos) : true;
    };

    const moveToLineBoundary = (boundary: "start" | "firstNonBlank" | "end") => {
      const { state } = context.editor;
      const $head = state.selection.$head;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      if (boundary === "start") {
        return setNormalSelectionAt(start);
      }
      if (boundary === "end") {
        return setNormalSelectionAt(Math.max(start, end - 1));
      }
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = text.search(/\S/u);
      return setNormalSelectionAt(offset === -1 ? start : start + offset);
    };

    const deleteCharacter = (direction: "before" | "at") => {
      const { state, view } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
      const from = direction === "before" ? Math.max(0, basePos - 1) : basePos;
      const to = direction === "before" ? basePos : Math.min(state.doc.content.size, basePos + 1);
      if (from >= to) {
        return true;
      }
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return setNormalSelectionAt(Math.min(from, context.editor.state.doc.content.size));
    };

    const changeToLineEnd = () => {
      const { state, view } = context.editor;
      const from = getBasePos(context.storage.mode, state.selection);
      const to = state.selection.$head.end(state.selection.$head.depth);
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return enterInsertAt(from);
    };

    const substituteCharacter = () => {
      const from = getBasePos(context.storage.mode, context.editor.state.selection);
      if (!deleteCharacter("at")) {
        return false;
      }
      return enterInsertAt(from);
    };

    const substituteLine = () => {
      const { state, view } = context.editor;
      const $head = state.selection.$head;
      const from = $head.start($head.depth);
      const to = $head.end($head.depth);
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return enterInsertAt(from);
    };

    const openLine = (direction: "above" | "below") => {
      const { state, view } = context.editor;
      const $head = state.selection.$head;
      const splitPosition = direction === "above"
        ? $head.start($head.depth)
        : $head.end($head.depth);
      if (!canSplit(state.doc, splitPosition)) {
        return false;
      }
      context.storage.mode = "insert";
      context.storage.visualAnchor = null;
      let tr = state.tr.split(splitPosition);
      const cursorPosition = direction === "above"
        ? splitPosition
        : splitPosition + 2;
      tr = tr
        .setSelection(TextSelection.create(tr.doc, cursorPosition))
        .setMeta(vimEnginePluginKey, {
          mode: "insert",
          pendingTokens: [],
          visualAnchor: null,
        });
      view.dispatch(tr.scrollIntoView());
      return true;
    };

    const deleteToLineEnd = () => {
      const { state, view } = context.editor;
      const from = getBasePos(context.storage.mode, state.selection);
      const to = state.selection.$head.end(state.selection.$head.depth);
      if (from >= to) {
        return true;
      }
      view.dispatch(state.tr.delete(from, to).scrollIntoView());
      return setNormalSelectionAt(from);
    };

    const handlePendingFindKey = (key: string) => {
      const pending = context.storage.pendingFind;
      if (!pending) {
        return null;
      }
      if (pending.expires < Date.now()) {
        context.storage.pendingFind = null;
        return null;
      }
      if (key.length !== 1) {
        return null;
      }
      context.storage.pendingFind = null;
      return findCharInBlock(pending.dir, key, pending.type);
    };

    const handlePendingReplaceKey = (key: string) => {
      const pending = context.storage.pendingReplace;
      if (!pending) {
        return null;
      }
      context.storage.pendingReplace = null;
      if (pending.expires < Date.now() || key.length !== 1) {
        return true;
      }
      const { state, view } = context.editor;
      const from = state.selection.from;
      const to = state.selection.empty
        ? Math.min(state.doc.content.size, state.selection.from + 1)
        : state.selection.to;
      if (from >= to) {
        return true;
      }
      view.dispatch(state.tr.insertText(key, from, to).scrollIntoView());
      return setNormalSelectionAt(from);
    };

    const isWordChar = (value: string) => /[A-Za-z0-9_]/.test(value);

    const findCharInBlock = (
      dir: 1 | -1,
      char: string,
      type: "f" | "t",
      options: { updateLastFind?: boolean } = {}
    ) => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);
      const searchFrom =
        dir === 1
          ? offset + 1
          : Math.max(0, offset - (context.storage.mode === "visual" ? 2 : 1));
      const nextIndex =
        dir === 1
          ? text.indexOf(char, searchFrom)
          : text.lastIndexOf(char, searchFrom);

      if (nextIndex === -1) {
        return true;
      }

      let targetPos = start + nextIndex;
      if (type === "t") {
        targetPos += dir === 1 ? -1 : 1;
      }
      if (context.storage.mode === "visual") {
        targetPos = clampPos(state.doc.content.size, targetPos + 1);
      }
      if (options.updateLastFind !== false) {
        context.storage.lastFind = { dir, char, type };
      }
      if (context.storage.mode === "visual") {
        return setVisualSelectionAt(targetPos);
      }
      return setNormalSelectionAt(targetPos);
    };

    const moveWordStartNext = () => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);

      for (let i = offset + 1; i < text.length; i += 1) {
        if (isWordChar(text[i]) && !isWordChar(text[i - 1] || " ")) {
          const targetPos = start + i;
          return context.storage.mode === "visual"
            ? setVisualSelectionAt(targetPos)
            : setNormalSelectionAt(targetPos);
        }
      }
      return true;
    };

    const moveWordEndNext = () => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const offset = Math.max(0, basePos - start);

      let inWord = false;
      const searchStart =
        isWordChar(text[offset] || "") && !isWordChar(text[offset + 1] || "")
          ? offset + 1
          : offset;
      for (let i = searchStart; i < text.length; i += 1) {
        const char = text[i];
        if (isWordChar(char)) {
          inWord = true;
        } else if (inWord) {
          const targetPos = start + Math.max(0, i - 1);
          return context.storage.mode === "visual"
            ? setVisualSelectionAt(targetPos)
            : setNormalSelectionAt(targetPos);
        }
      }

      if (inWord) {
        const targetPos = start + Math.max(0, text.length - 1);
        return context.storage.mode === "visual"
          ? setVisualSelectionAt(targetPos)
          : setNormalSelectionAt(targetPos);
      }

      return true;
    };

    const moveWordStartPrev = () => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
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
          return context.storage.mode === "visual"
            ? setVisualSelectionAt(targetPos)
            : setNormalSelectionAt(targetPos);
        }
      }
      return true;
    };

    const getWordMotionTarget = (motion: "w" | "e" | "b", count = 1) => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      if (!text.length) {
        return null;
      }
      let offset = Math.max(0, Math.min(text.length - 1, basePos - start));

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

      let targetIndex = offset;
      for (let index = 0; index < count; index += 1) {
        targetIndex =
          motion === "w"
            ? findNextWordStart()
            : motion === "e"
              ? findWordEnd()
              : findPrevWordStart();
        offset = motion === "e" ? Math.min(text.length - 1, targetIndex + 1) : targetIndex;
      }

      return start + targetIndex;
    };

    const getInnerWordRange = () => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
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

    const getAroundWordRange = () => {
      const range = getInnerWordRange();
      if (!range) {
        return null;
      }
      const { state } = context.editor;
      const blockEnd = state.selection.$head.end(state.selection.$head.depth);
      let to = range.to;
      while (to < blockEnd && /\s/u.test(state.doc.textBetween(to, to + 1))) {
        to += 1;
      }
      if (to === range.to) {
        let from = range.from;
        const blockStart = state.selection.$head.start(state.selection.$head.depth);
        while (from > blockStart && /\s/u.test(state.doc.textBetween(from - 1, from))) {
          from -= 1;
        }
        return { from, to };
      }
      return { from: range.from, to };
    };

    const getDelimitedRange = (open: string, close: string, around: boolean) => {
      const { state } = context.editor;
      const { $head } = state.selection;
      const start = $head.start($head.depth);
      const end = $head.end($head.depth);
      const text = state.doc.textBetween(start, end, "\n", "\n");
      const cursor = Math.max(0, Math.min(text.length, getBasePos(context.storage.mode, state.selection) - start));
      let left = -1;
      let right = -1;

      if (open === close) {
        left = text.lastIndexOf(open, Math.max(0, cursor));
        right = text.indexOf(close, Math.max(cursor + 1, left + 1));
      } else {
        let depth = 0;
        for (let index = Math.min(cursor, text.length - 1); index >= 0; index -= 1) {
          if (text[index] === close) {
            depth += 1;
          } else if (text[index] === open) {
            if (depth === 0) {
              left = index;
              break;
            }
            depth -= 1;
          }
        }
        if (left !== -1) {
          depth = 0;
          for (let index = left + 1; index < text.length; index += 1) {
            if (text[index] === open) {
              depth += 1;
            } else if (text[index] === close) {
              if (depth === 0) {
                right = index;
                break;
              }
              depth -= 1;
            }
          }
        }
      }
      if (left === -1 || right === -1 || left >= right) {
        return null;
      }
      return around
        ? { from: start + left, to: start + right + 1 }
        : { from: start + left + 1, to: start + right };
    };

    const getTextObjectRange = (target: string) => {
      switch (target) {
        case "iw":
          return getInnerWordRange();
        case "aw":
          return getAroundWordRange();
        case "i\"":
          return getDelimitedRange('"', '"', false);
        case "a\"":
          return getDelimitedRange('"', '"', true);
        case "i'":
          return getDelimitedRange("'", "'", false);
        case "a'":
          return getDelimitedRange("'", "'", true);
        case "i(":
          return getDelimitedRange("(", ")", false);
        case "a(":
          return getDelimitedRange("(", ")", true);
        case "i[":
          return getDelimitedRange("[", "]", false);
        case "a[":
          return getDelimitedRange("[", "]", true);
        case "i{":
          return getDelimitedRange("{", "}", false);
        case "a{":
          return getDelimitedRange("{", "}", true);
        default:
          return null;
      }
    };

    const applyOperatorRange = (operator: "c" | "d" | "y", from: number, to: number) => {
      const { state, view } = context.editor;
      const rangeFrom = clampPos(state.doc.content.size, Math.min(from, to));
      const rangeTo = clampPos(state.doc.content.size, Math.max(from, to));
      if (rangeFrom === rangeTo) {
        return true;
      }
      if (operator === "y") {
        context.storage.yankSlice = state.doc.slice(rangeFrom, rangeTo);
        return setNormalSelectionAt(rangeFrom);
      }
      view.dispatch(state.tr.delete(rangeFrom, rangeTo).scrollIntoView());
      return operator === "c" ? enterInsertAt(rangeFrom) : setNormalSelectionAt(rangeFrom);
    };

    const handlePendingWordKey = (key: string) => {
      const pending = context.storage.pendingWordOp;
      if (!pending) {
        return null;
      }
      if (pending.expires < Date.now()) {
        context.storage.pendingWordOp = null;
        return null;
      }
      if (pending.step === "i") {
        if (key === "i") {
          context.storage.pendingWordOp = {
            op: pending.op,
            step: "w",
            expires: Date.now() + 800,
          };
          return true;
        }
        context.storage.pendingWordOp = null;
        return null;
      }
      if (pending.step === "w") {
        if (key !== "w") {
          context.storage.pendingWordOp = null;
          return null;
        }
        context.storage.pendingWordOp = null;
        const range = getInnerWordRange();
        if (!range) {
          return true;
        }
        if (pending.op === "v") {
          context.storage.mode = "visual";
          context.storage.visualAnchor = range.from;
          const { state, view } = context.editor;
          view.dispatch(
            state.tr.setSelection(
              TextSelection.create(state.doc, range.from, range.to)
            )
          );
          return true;
        }
        const { state, view } = context.editor;
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
    const applyOpMotion = (
      op: "c" | "d" | "y",
      motion: "w" | "e" | "b",
      count = takeCount()
    ) => {
      const { state } = context.editor;
      const basePos = getBasePos(context.storage.mode, state.selection);
      const targetPos = getWordMotionTarget(motion, count);
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

      return applyOperatorRange(op, from, to);
    };

    /**
     * Tiptap remains responsible for rich-editor actions, while command parsing
     * and pending input live in the ProseMirror plugin. This lets the adapter
     * execute a parsed command without keeping timing-based key state in
     * extension storage.
     */
    const consumeEngineKey = (key: string): boolean | null => {
      if (
        !context.storage.enabled ||
        context.storage.commandActive ||
        context.storage.mode !== "normal" ||
        key.length !== 1
      ) {
        return null;
      }

      return consumeVimEngineInput(
        {
          enabled: context.storage.enabled,
          mode: context.storage.mode,
          commandActive: context.storage.commandActive,
          state: context.editor.state,
          dispatch: (transaction) => context.editor.view.dispatch(transaction),
        },
        key,
        executeEngineCommand
      );
    };

    const consumeVisualFormattingKey = (key: string): boolean | null => {
      if (
        !context.storage.enabled ||
        context.storage.commandActive ||
        context.storage.mode !== "visual" ||
        key.length !== 1
      ) {
        return null;
      }
      return consumeVimEngineInput(
        {
          enabled: context.storage.enabled,
          mode: context.storage.mode,
          commandActive: context.storage.commandActive,
          state: context.editor.state,
          dispatch: (transaction) => context.editor.view.dispatch(transaction),
          definitions: visualFormattingDefinitions,
          acceptedModes: ["visual"],
        },
        key,
        executeEngineCommand
      );
    };

    const executeEngineCommand = (command: ParsedVimCommand) => {
      const repeat = (action: () => boolean) => {
        let handled = true;
        for (let index = 0; index < command.count; index += 1) {
          handled = action();
          if (!handled) {
            break;
          }
        }
        return handled;
      };

      const selectCurrentLine = () => {
        const { state, view } = context.editor;
        const { $head } = state.selection;
        const start = $head.start($head.depth);
        const end = $head.end($head.depth);
        context.storage.mode = "visual";
        context.storage.visualAnchor = start;
        view.dispatch(
          state.tr
            .setSelection(TextSelection.create(state.doc, start, end))
            .setMeta(vimEnginePluginKey, { mode: "visual", visualAnchor: start })
        );
        return true;
      };

      const applyTextObject = (operator: "c" | "d" | "y", target: string) => {
        const range = getTextObjectRange(target);
        if (!range) {
          return true;
        }
        return applyOperatorRange(operator, range.from, range.to);
      };

      const applyLineMotion = (operator: "c" | "d" | "y", direction: 1 | -1) => {
        const { state } = context.editor;
        const currentBlockPos = state.selection.$head.before(state.selection.$head.depth);
        const blocks: Array<{ from: number; to: number }> = [];
        state.doc.descendants((node, pos) => {
          if (node.isTextblock) {
            blocks.push({ from: pos + 1, to: pos + node.nodeSize - 1 });
          }
        });
        const currentIndex = blocks.findIndex((block) => block.from - 1 === currentBlockPos);
        if (currentIndex === -1) {
          return true;
        }
        const targetIndex = Math.max(0, Math.min(blocks.length - 1, currentIndex + direction * command.count));
        const from = direction < 0 ? blocks[targetIndex].from : blocks[currentIndex].from;
        const to = direction < 0 ? blocks[currentIndex].to : blocks[targetIndex].to;
        return applyOperatorRange(operator, from, to);
      };

      const applyBoundaryMotion = (operator: "c" | "d" | "y", target: string) => {
        const { state } = context.editor;
        const base = getBasePos(context.storage.mode, state.selection);
        const { $head } = state.selection;
        const start = $head.start($head.depth);
        const end = $head.end($head.depth);
        if (target === "h") {
          return applyOperatorRange(operator, Math.max(start, base - command.count), base + 1);
        }
        if (target === "l") {
          return applyOperatorRange(operator, base, Math.min(end, base + command.count));
        }
        if (target === "0") {
          return applyOperatorRange(operator, start, base + 1);
        }
        if (target === "^") {
          const text = state.doc.textBetween(start, end, "\n", "\n");
          const firstNonBlank = text.search(/\S/u);
          return applyOperatorRange(operator, start + Math.max(0, firstNonBlank), base + 1);
        }
        if (target === "$") {
          return applyOperatorRange(operator, base, end);
        }
        if (target === "gg") {
          return applyOperatorRange(operator, getFirstTextblockPos(state.doc), base + 1);
        }
        if (target === "G") {
          return applyOperatorRange(operator, base, state.doc.content.size);
        }
        return true;
      };

      if (command.operator && command.target) {
        const operator = command.operator as "c" | "d" | "y";
        if (command.target === "d") {
          return operator === "d" ? repeat(deleteCurrentLine) : true;
        }
        if (command.target === "c") {
          return operator === "c" ? repeat(substituteLine) : true;
        }
        if (command.target === "y") {
          return operator === "y" ? repeat(yankCurrentLine) : true;
        }
        if (command.target.startsWith("i") || command.target.startsWith("a")) {
          return applyTextObject(operator, command.target);
        }
        if (command.target === "w" || command.target === "e" || command.target === "b") {
          return applyOpMotion(operator, command.target, command.count);
        }
        if (command.target === "j" || command.target === "k") {
          return applyLineMotion(operator, command.target === "j" ? 1 : -1);
        }
        return applyBoundaryMotion(operator, command.target);
      }

      if (command.action) {
        switch (command.action) {
          case "i":
            return enterInsertAt(getBasePos(context.storage.mode, context.editor.state.selection));
          case "a": {
            const { state } = context.editor;
            return enterInsertAt(
              clampPos(state.doc.content.size, state.selection.from + (state.selection.empty ? 0 : 1))
            );
          }
          case "o":
            return openLine("below");
          case "O":
            return openLine("above");
          case "v":
            return context.editor.commands.enterVisualMode();
          case "V":
            return selectCurrentLine();
          case "p":
            return pasteAfter();
          case "P":
            return pasteBefore();
          case "u":
            return context.editor.commands.undo?.() ?? false;
          case "gb":
            return context.editor.chain().focus().toggleBold().run();
          case "gi":
            return context.editor.chain().focus().toggleItalic().run();
          case "gu":
            return context.editor.chain().focus().toggleUnderline().run();
          case "gp":
            return context.editor.chain().focus().setParagraph().run();
          case "gc":
            return context.editor.chain().focus().addPendingComment().run();
          case "g1":
          case "g2":
          case "g3":
          case "g4":
          case "g5":
            return context.editor.chain().focus().toggleHeading({
              level: Number(command.action[1]) as 1 | 2 | 3 | 4 | 5,
            }).run();
        }
      }

      switch (command.target) {
        case "h":
          return repeat(moveBy(-1));
        case "j":
          return repeat(moveLine(1));
        case "k":
          return repeat(moveLine(-1));
        case "l":
          return repeat(moveBy(1));
        case "w":
          return repeat(moveWordStartNext);
        case "e":
          return repeat(moveWordEndNext);
        case "b":
          return repeat(moveWordStartPrev);
        case "0":
          return moveToLineBoundary("start");
        case "^":
          return moveToLineBoundary("firstNonBlank");
        case "$":
          return moveToLineBoundary("end");
        case "gg":
          return setNormalSelectionAt(getFirstTextblockPos(context.editor.state.doc));
        case "G":
          return setNormalSelectionAt(context.editor.state.doc.content.size);
      }
      return false;
    };

    const yankSelection = () => {
      const { state, view } = context.editor;
      if (state.selection.empty) {
        return true;
      }
      context.storage.yankSlice = state.selection.content();
      context.storage.mode = "normal";
      context.storage.visualAnchor = null;
      const pos = state.selection.from;
      const { from, to } = getNormalRange(state.doc, pos);
      view.dispatch(
        state.tr.setSelection(TextSelection.create(state.doc, from, to))
      );
      return true;
    };

    const syncCommandUI = () => {
      updateCommandAttributes(
        context.editor.view.dom as HTMLElement,
        context.storage
      );
    };

    const exitCommandMode = () => {
      context.storage.commandActive = false;
      context.storage.commandBuffer = "";
      context.storage.commandPaletteQuery = "";
      context.storage.commandSelectionIndex = null;
      syncCommandUI();
      return true;
    };

    const replaceSelection = () => {
      const { state, view } = context.editor;
      const { from, to, empty } = state.selection;
      const marks = empty
        ? state.storedMarks ?? state.selection.$from.marks()
        : state.doc.resolve(from).marks();
      if (!empty) {
        const tr = state.tr
          .delete(from, to)
          .setSelection(TextSelection.create(state.tr.doc, from))
          .setStoredMarks(marks);
        view.dispatch(tr);
      }
      context.storage.mode = "insert";
      context.storage.visualAnchor = null;
      if (empty) {
        view.dispatch(
          state.tr
            .setSelection(TextSelection.create(state.doc, from))
            .setStoredMarks(marks)
        );
      }
      return true;
    };

    const executeCommand = () =>
      executeVimCommand({
        editor: context.editor,
        storage: context.storage,
        onQuit: context.options.onQuit,
        exitCommandMode,
        replaceSelection,
        jumpSearch,
      });

    const enterCommandMode = () => {
      if (context.storage.mode === "insert") {
        return false;
      }
      context.storage.commandActive = true;
      context.storage.commandBuffer = "";
      context.storage.commandPaletteQuery = "";
      context.storage.commandSelectionIndex = null;
      syncCommandUI();
      return true;
    };

    const enterSearchMode = (direction: 1 | -1) => {
      if (!enterCommandMode()) {
        return false;
      }
      context.storage.commandBuffer = direction === 1 ? "/" : "?";
      context.storage.commandPaletteQuery = "";
      syncCommandUI();
      return true;
    };

    const getSearchMatches = (state: Selection["$from"]["doc"], query: string) => {
      const matches: Array<{ from: number; to: number }> = [];
      if (!query) {
        return matches;
      }
      state.descendants((node, pos) => {
        if (!node.isText) {
          return;
        }
        const text = node.text || "";
        let index = text.indexOf(query);
        while (index !== -1) {
          matches.push({ from: pos + index, to: pos + index + query.length });
          index = text.indexOf(query, index + query.length);
        }
      });
      return matches;
    };

    const jumpSearch = (dir: 1 | -1) => {
      if (context.storage.mode === "insert") {
        return false;
      }
      const query = context.storage.searchQuery;
      if (!query) {
        return true;
      }
      const { state } = context.editor;
      const matches = getSearchMatches(state.doc, query);
      context.storage.searchMatchCount = matches.length;
      if (!matches.length) {
        context.storage.searchMatchIndex = null;
        return true;
      }
      const basePos = getBasePos(context.storage.mode, state.selection);
      let targetIndex = 0;
      if (dir === 1) {
        targetIndex = matches.findIndex((match) => match.from > basePos);
        if (targetIndex === -1) {
          targetIndex = 0;
        }
      } else {
        targetIndex = matches.length - 1;
        for (let i = matches.length - 1; i >= 0; i -= 1) {
          if (matches[i].from < basePos) {
            targetIndex = i;
            break;
          }
        }
      }
      context.storage.searchMatchIndex = targetIndex;
      const target = matches[targetIndex];
      if (context.storage.mode === "visual") {
        return setVisualSelectionAt(target.from);
      }
      return setNormalSelectionAt(target.from);
    };

    const withFind = (key: string, handler: () => boolean) => {
      return () => {
        if (!context.storage.enabled) {
          return false;
        }
        if (context.storage.commandActive) {
          if (key.length === 1 && printableChars.includes(key)) {
            context.storage.commandBuffer += key;
            context.storage.commandPaletteQuery = context.storage.commandBuffer;
            context.storage.commandSelectionIndex = null;
            syncCommandUI();
          }
          return true;
        }
        if (context.storage.mode === "insert" && key.length === 1) {
          return false;
        }
        const visualFormatResult = consumeVisualFormattingKey(key);
        if (visualFormatResult !== null) {
          return visualFormatResult;
        }
        const engineResult = consumeEngineKey(key);
        if (engineResult !== null) {
          return engineResult;
        }
        const pendingWord = handlePendingWordKey(key);
        if (pendingWord !== null) {
          return pendingWord;
        }
        const pending = handlePendingFindKey(key);
        if (pending !== null) {
          return pending;
        }
        const replace = handlePendingReplaceKey(key);
        if (replace !== null) {
          return replace;
        }
        return handler();
      };
    };

    const withEnabled = (handler: () => boolean) => {
      return () => {
        if (!context.storage.enabled) {
          return false;
        }
        if (context.storage.commandActive) {
          return false;
        }
        return handler();
      };
    };

    const repeatLastFind = () => {
      if (!context.storage.lastFind || context.storage.mode === "insert") {
        return false;
      }
      return findCharInBlock(
        context.storage.lastFind.dir,
        context.storage.lastFind.char,
        context.storage.lastFind.type,
        { updateLastFind: false }
      );
    };

    const repeatLastFindReverse = () => {
      if (!context.storage.lastFind || context.storage.mode === "insert") {
        return false;
      }
      return findCharInBlock(
        (context.storage.lastFind.dir * -1) as 1 | -1,
        context.storage.lastFind.char,
        context.storage.lastFind.type,
        { updateLastFind: false }
      );
    };

    const shortcuts: Record<string, (props?: unknown) => boolean> = {
      Escape: () => {
        if (context.storage.commandActive) {
          return exitCommandMode();
        }
        context.storage.pendingCount = "";
        context.editor.commands.enterNormalMode();
        return true;
      },
      Enter: () => {
        if (!context.storage.enabled || !context.storage.commandActive) {
          return false;
        }
        return executeCommand();
      },
      Backspace: () => {
        if (!context.storage.enabled || !context.storage.commandActive) {
          return false;
        }
        context.storage.commandBuffer = context.storage.commandBuffer.slice(0, -1);
        context.storage.commandPaletteQuery = context.storage.commandBuffer;
        context.storage.commandSelectionIndex = null;
        syncCommandUI();
        return true;
      },
      Tab: () => {
        if (!context.storage.enabled || !context.storage.commandActive) {
          return false;
        }
        const suggestions = getVimCommandSuggestions(context.storage.commandPaletteQuery);
        if (!suggestions.length) {
          return true;
        }
        context.storage.commandSelectionIndex =
          context.storage.commandSelectionIndex == null
            ? 0
            : (context.storage.commandSelectionIndex + 1) % suggestions.length;
        context.storage.commandBuffer = suggestions[context.storage.commandSelectionIndex].completion;
        syncCommandUI();
        return true;
      },
      ArrowDown: () => {
        if (!context.storage.enabled || !context.storage.commandActive) {
          return false;
        }
        const suggestions = getVimCommandSuggestions(context.storage.commandPaletteQuery);
        if (!suggestions.length) {
          return true;
        }
        context.storage.commandSelectionIndex =
          context.storage.commandSelectionIndex == null
            ? 0
            : (context.storage.commandSelectionIndex + 1) % suggestions.length;
        context.storage.commandBuffer = suggestions[context.storage.commandSelectionIndex].completion;
        syncCommandUI();
        return true;
      },
      "Shift-Tab": () => {
        if (!context.storage.enabled || !context.storage.commandActive) {
          return false;
        }
        const suggestions = getVimCommandSuggestions(context.storage.commandPaletteQuery);
        if (!suggestions.length) {
          return true;
        }
        context.storage.commandSelectionIndex =
          context.storage.commandSelectionIndex == null
            ? suggestions.length - 1
            : (context.storage.commandSelectionIndex - 1 + suggestions.length) % suggestions.length;
        context.storage.commandBuffer = suggestions[context.storage.commandSelectionIndex].completion;
        syncCommandUI();
        return true;
      },
      ArrowUp: () => {
        if (!context.storage.enabled || !context.storage.commandActive) {
          return false;
        }
        const suggestions = getVimCommandSuggestions(context.storage.commandPaletteQuery);
        if (!suggestions.length) {
          return true;
        }
        context.storage.commandSelectionIndex =
          context.storage.commandSelectionIndex == null
            ? suggestions.length - 1
            : (context.storage.commandSelectionIndex - 1 + suggestions.length) % suggestions.length;
        context.storage.commandBuffer = suggestions[context.storage.commandSelectionIndex].completion;
        syncCommandUI();
        return true;
      },
      ":": () => {
        if (!context.storage.enabled) {
          return false;
        }
        if (context.storage.commandActive) {
          return false;
        }
        return enterCommandMode();
      },
      "/": () => enterSearchMode(1),
      "?": () => enterSearchMode(-1),
      "Mod-c": withEnabled(() => {
        context.editor.commands.enterNormalMode();
        return true;
      }),
      i: withFind("i", () => {
        if (context.storage.mode === "visual") {
          context.storage.pendingWordOp = {
            op: "v",
            step: "w",
            expires: Date.now() + 800,
          };
          return true;
        }
        if (context.storage.mode !== "normal") {
          return false;
        }
        const { state } = context.editor;
        return enterInsertAt(getBasePos(context.storage.mode, state.selection));
      }),
      a: withFind("a", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        const { state } = context.editor;
        return enterInsertAt(
          clampPos(
            state.doc.content.size,
            state.selection.from + (state.selection.empty ? 0 : 1)
          )
        );
      }),
      I: withFind("I", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        const { state } = context.editor;
        const { $head } = state.selection;
        return enterInsertAt($head.start($head.depth));
      }),
      A: withFind("A", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        const { state } = context.editor;
        const { $head } = state.selection;
        return enterInsertAt($head.end($head.depth));
      }),
      "0": withFind("0", () =>
        context.storage.mode === "insert"
          ? false
          : context.storage.pendingCount
            ? appendCount("0")
            : moveToLineBoundary("start")
      ),
      "^": withFind("^", () =>
        context.storage.mode === "insert"
          ? false
          : (takeCount(), moveToLineBoundary("firstNonBlank"))
      ),
      "$": withFind("$", () =>
        context.storage.mode === "insert"
          ? false
          : (takeCount(), moveToLineBoundary("end"))
      ),
      o: withFind("o", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        return openLine("below");
      }),
      O: withFind("O", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        return openLine("above");
      }),
      v: withFind("v", () => {
        if (context.storage.mode !== "visual") {
          context.editor.commands.enterVisualMode();
          context.storage.pendingWordOp = {
            op: "v",
            step: "i",
            expires: Date.now() + 800,
          };
          return true;
        }
        context.editor.commands.enterNormalMode();
        return true;
      }),
      V: withFind("V", () => {
        if (context.storage.mode !== "visual") {
          const { state, view } = context.editor;
          const { $head } = state.selection;
          const start = $head.start($head.depth);
          const end = $head.end($head.depth);
          context.storage.mode = "visual";
          context.storage.visualAnchor = start;
          view.dispatch(
            state.tr.setSelection(TextSelection.create(state.doc, start, end))
          );
          return true;
        }
        context.editor.commands.enterNormalMode();
        return true;
      }),
      h: withFind("h", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveBy(-1))
      ),
      l: withFind("l", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveBy(1))
      ),
      j: withFind("j", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveLine(1))
      ),
      k: withFind("k", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveLine(-1))
      ),
      c: withFind("c", () => {
        // Normal-mode operators are consumed by the ProseMirror engine.
        return context.storage.mode === "normal";
      }),
      d: withFind("d", () => {
        if (context.storage.mode === "visual") {
          const { state, view } = context.editor;
          view.dispatch(state.tr.deleteSelection().scrollIntoView());
          context.editor.commands.enterNormalMode();
          return true;
        }
        if (context.storage.mode !== "normal") {
          return false;
        }
        return true;
      }),
      y: withFind("y", () => {
        if (context.storage.mode === "visual") {
          return yankSelection();
        }
        return context.storage.mode === "normal";
      }),
      p: withFind("p", () =>
        context.storage.mode === "insert" ? false : pasteAfter()
      ),
      P: withFind("P", () =>
        context.storage.mode === "insert" ? false : pasteBefore()
      ),
      x: withFind("x", () =>
        context.storage.mode === "insert" ? false : deleteCharacter("at")
      ),
      X: withFind("X", () =>
        context.storage.mode === "insert" ? false : deleteCharacter("before")
      ),
      D: withFind("D", () =>
        context.storage.mode === "normal" ? deleteToLineEnd() : false
      ),
      C: withFind("C", () =>
        context.storage.mode === "normal" ? changeToLineEnd() : false
      ),
      s: withFind("s", () =>
        context.storage.mode === "normal" ? substituteCharacter() : false
      ),
      S: withFind("S", () =>
        context.storage.mode === "normal" ? substituteLine() : false
      ),
      J: withFind("J", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        const position = getBasePos(context.storage.mode, context.editor.state.selection);
        const joined = context.editor.chain().focus().setTextSelection(position).joinForward().run();
        return joined ? setNormalSelectionAt(position) : false;
      }),
      r: withFind("r", () => {
        if (context.storage.mode === "insert") {
          return false;
        }
        context.storage.pendingReplace = { expires: Date.now() + 1500 };
        return true;
      }),
      f: withFind("f", () => {
        if (context.storage.mode === "insert") {
          return false;
        }
        context.storage.pendingFind = { dir: 1, expires: Date.now() + 1500, type: "f" };
        return true;
      }),
      F: withFind("F", () => {
        if (context.storage.mode === "insert") {
          return false;
        }
        context.storage.pendingFind = { dir: -1, expires: Date.now() + 1500, type: "f" };
        return true;
      }),
      t: withFind("t", () => {
        if (context.storage.mode === "insert") {
          return false;
        }
        context.storage.pendingFind = { dir: 1, expires: Date.now() + 1500, type: "t" };
        return true;
      }),
      T: withFind("T", () => {
        if (context.storage.mode === "insert") {
          return false;
        }
        context.storage.pendingFind = { dir: -1, expires: Date.now() + 1500, type: "t" };
        return true;
      }),
      ";": withFind(";", repeatLastFind),
      ",": withFind(",", repeatLastFindReverse),
      Semicolon: withFind("Semicolon", repeatLastFind),
      Comma: withFind("Comma", repeatLastFindReverse),
      g: withFind("g", () => context.storage.mode === "normal"),
      G: withFind("G", () => {
        if (context.storage.mode === "insert") {
          return false;
        }
        const { state } = context.editor;
        return context.storage.mode === "visual"
          ? setVisualSelectionAt(state.doc.content.size)
          : setNormalSelectionAt(state.doc.content.size);
      }),
      w: withFind("w", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveWordStartNext)
      ),
      e: withFind("e", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveWordEndNext)
      ),
      b: withFind("b", () =>
        context.storage.mode === "insert" ? false : repeatMotion(moveWordStartPrev)
      ),
      u: withFind("u", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        if (context.editor.commands.undo) {
          context.editor.commands.undo();
          return true;
        }
        return false;
      }),
      "Mod-r": withFind("Mod-r", () => {
        if (context.storage.mode !== "normal") {
          return false;
        }
        if (context.editor.commands.redo) {
          context.editor.commands.redo();
          return true;
        }
        return false;
      }),
      n: withFind("n", () => jumpSearch(context.storage.searchDirection)),
      N: withFind("N", () => jumpSearch((context.storage.searchDirection * -1) as 1 | -1)),
    };

    for (const digit of "123456789") {
      shortcuts[digit] = () => consumeEngineKey(digit) ?? appendCount(digit);
    }

    for (const char of printableChars) {
      if (!shortcuts[char]) {
        shortcuts[char] = withFind(char, () => context.storage.mode !== "insert");
      }
    }

  return shortcuts;
};
