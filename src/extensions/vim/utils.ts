import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Selection } from "@tiptap/pm/state";

import type { VimMode, VimModeStorage } from "./types";

export const printableChars =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}\\|;:'\",.<>?/~`";

export const clampPos = (docSize: number, pos: number) =>
  Math.max(0, Math.min(docSize, pos));

export const isCommandInputKey = (key: string, event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return false;
  }
  return key === " " || (key.length === 1 && printableChars.includes(key));
};

export const updateCommandAttributes = (
  element: HTMLElement,
  storage: Pick<VimModeStorage, "enabled" | "commandActive" | "commandBuffer" | "commandSelectionIndex">
) => {
  if (!storage.enabled || !storage.commandActive) {
    element.removeAttribute("data-vim-command");
    element.removeAttribute("data-vim-command-active");
    element.removeAttribute("data-vim-command-index");
    return;
  }
  element.setAttribute("data-vim-command", storage.commandBuffer);
  element.setAttribute("data-vim-command-active", "true");
  if (storage.commandSelectionIndex == null) {
    element.removeAttribute("data-vim-command-index");
  } else {
    element.setAttribute("data-vim-command-index", String(storage.commandSelectionIndex));
  }
};

export const getNormalRange = (doc: Selection["$from"]["doc"], pos: number) => {
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

export const getBasePos = (mode: VimMode, selection: Selection) =>
  mode === "normal" && !selection.empty ? selection.from : selection.$head.pos;

export interface VimBlockRange {
  from: number;
  to: number;
}

export const getTextblockRanges = (doc: Selection["$from"]["doc"]) => {
  const blocks: Array<{ from: number; to: number }> = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      blocks.push({ from: pos + 1, to: pos + node.nodeSize - 1 });
    }
  });
  return blocks;
};

/**
 * Turns two document positions into rectangular, per-textblock ranges.
 * Columns are document text offsets, deliberately not screen pixels: wrapped
 * lines and non-text nodes are outside the first Visual Block scope.
 */
export const getVisualBlockRanges = (
  doc: Selection["$from"]["doc"],
  anchor: number,
  head: number
): VimBlockRange[] => {
  const blocks = getTextblockRanges(doc);
  const findBlock = (pos: number) => blocks.findIndex((block) => pos >= block.from && pos <= block.to);
  const anchorIndex = findBlock(clampPos(doc.content.size, anchor));
  const headIndex = findBlock(clampPos(doc.content.size, head));
  if (anchorIndex < 0 || headIndex < 0) {
    return [];
  }
  const anchorColumn = Math.max(0, Math.min(blocks[anchorIndex].to - blocks[anchorIndex].from, anchor - blocks[anchorIndex].from));
  const headColumn = Math.max(0, Math.min(blocks[headIndex].to - blocks[headIndex].from, head - blocks[headIndex].from));
  const fromColumn = Math.min(anchorColumn, headColumn);
  const toColumn = Math.max(anchorColumn, headColumn) + 1;
  const fromIndex = Math.min(anchorIndex, headIndex);
  const toIndex = Math.max(anchorIndex, headIndex);

  return blocks.slice(fromIndex, toIndex + 1).map((block) => ({
    from: block.from + Math.min(fromColumn, block.to - block.from),
    to: block.from + Math.min(toColumn, block.to - block.from),
  }));
};

export const getFirstTextblockPos = (doc: Selection["$from"]["doc"]) => {
  let firstPosition: number | null = null;
  doc.descendants((node, pos) => {
    if (firstPosition == null && node.isTextblock) {
      firstPosition = pos + 1;
      return false;
    }
    return false;
  });
  return firstPosition ?? 0;
};

export const getNormalCursorPos = (
  doc: Selection["$from"]["doc"],
  caretPos: number
) => {
  const $caret = doc.resolve(clampPos(doc.content.size, caretPos));
  if ($caret.parent.isTextblock) {
    const start = $caret.start();
    const end = $caret.end();
    return caretPos <= start ? start : Math.max(start, Math.min(end - 1, caretPos - 1));
  }
  return getFirstTextblockPos(doc);
};

export const clampToTextblock = (
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
