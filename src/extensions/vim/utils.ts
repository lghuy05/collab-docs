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
  return key.length === 1 && printableChars.includes(key);
};

export const updateCommandAttributes = (
  element: HTMLElement,
  storage: Pick<VimModeStorage, "enabled" | "commandActive" | "commandBuffer">
) => {
  if (!storage.enabled || !storage.commandActive) {
    element.removeAttribute("data-vim-command");
    element.removeAttribute("data-vim-command-active");
    return;
  }
  element.setAttribute("data-vim-command", storage.commandBuffer);
  element.setAttribute("data-vim-command-active", "true");
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
