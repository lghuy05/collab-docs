import type { Editor } from "@tiptap/core";

import type { VimModeStorage } from "./types";

export interface ExecuteVimCommandContext {
  editor: Editor;
  storage: VimModeStorage;
  onQuit?: () => void;
  exitCommandMode: () => boolean;
  replaceSelection: () => boolean;
}

/**
 * Executes the Ex-style commands currently supported by Collab Docs.
 *
 * This is intentionally a behavior-preserving registry boundary. A later Vim
 * feature pass can replace the conditional dispatch with typed, configurable
 * command registrations without coupling that work to the input engine.
 */
export const executeVimCommand = ({
  editor,
  storage,
  onQuit,
  exitCommandMode,
  replaceSelection,
}: ExecuteVimCommandContext) => {
  const raw = storage.commandBuffer.trim();
  if (!raw) {
    return exitCommandMode();
  }
  const trimmed = raw.startsWith(":") ? raw.slice(1) : raw;
  if (trimmed.startsWith("/")) {
    storage.searchQuery = trimmed.slice(1);
    editor.view.dispatch(editor.state.tr);
    return exitCommandMode();
  }
  const name = trimmed.toLowerCase();
  const chain = editor.chain().focus();

  const toHexColor = (value: string) => {
    if (!value) {
      return null;
    }
    const normalized = value.startsWith("#") ? value : `#${value}`;
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalized)
      ? normalized
      : null;
  };

  if (name === "q" || name === "quit") {
    exitCommandMode();
    onQuit?.();
    return true;
  }
  if (name === "bold") {
    chain.toggleBold().run();
    return exitCommandMode();
  }
  if (name === "italic") {
    chain.toggleItalic().run();
    return exitCommandMode();
  }
  if (name === "underline") {
    chain.toggleUnderline().run();
    return exitCommandMode();
  }
  if (name === "left" || name === "center" || name === "right" || name === "justify") {
    chain.setTextAlign(name).run();
    return exitCommandMode();
  }
  const heading = /^(?:h|heading-)([1-5])$/.exec(name);
  if (heading) {
    chain.toggleHeading({ level: Number(heading[1]) as 1 | 2 | 3 | 4 | 5 }).run();
    return exitCommandMode();
  }
  if (name === "p" || name === "paragraph" || name === "normal") {
    chain.setParagraph().run();
    return exitCommandMode();
  }
  if (name === "bullet" || name === "bullets" || name === "ul") {
    chain.toggleBulletList().run();
    return exitCommandMode();
  }
  if (name === "ordered" || name === "ol") {
    chain.toggleOrderedList().run();
    return exitCommandMode();
  }
  if (name === "todo" || name === "task") {
    chain.toggleTaskList().run();
    return exitCommandMode();
  }
  if (name === "comment") {
    chain.addPendingComment().run();
    return exitCommandMode();
  }
  if (name === "rp" || name === "replace") {
    replaceSelection();
    return exitCommandMode();
  }
  if (name === "remove" || name === "clear" || name === "clean") {
    chain.unsetAllMarks().run();
    return exitCommandMode();
  }
  if (name === "undo" || name === "u") {
    chain.undo().run();
    return exitCommandMode();
  }
  if (name === "redo") {
    chain.redo().run();
    return exitCommandMode();
  }
  if (name === "print") {
    if (typeof window !== "undefined") {
      window.print();
    }
    return exitCommandMode();
  }
  if (name === "spell") {
    const current = editor.view.dom.getAttribute("spellcheck");
    editor.view.dom.setAttribute("spellcheck", current === "false" ? "true" : "false");
    return exitCommandMode();
  }
  if (name === "vim") {
    editor.commands.toggleVimMode();
    return exitCommandMode();
  }
  if (name === "noh" || name === "nohl" || name === "nohlsearch") {
    storage.searchQuery = "";
    editor.view.dispatch(editor.state.tr);
    return exitCommandMode();
  }
  if (name.startsWith("fs-") || name.startsWith("size-")) {
    const sizeLabel = name.startsWith("fs-") ? "fs-" : "size-";
    const size = Number(name.slice(sizeLabel.length));
    if (!Number.isNaN(size) && size > 0) {
      chain.setFontSize(`${size}px`).run();
    }
    return exitCommandMode();
  }
  if (name.startsWith("line-")) {
    const value = name.slice("line-".length);
    if (value) {
      chain.setLineHeight(value).run();
    }
    return exitCommandMode();
  }
  if (name === "font-tnr") {
    chain.setFontFamily("Times New Roman").run();
    return exitCommandMode();
  }
  if (name.startsWith("font-")) {
    const fontKey = name.slice("font-".length);
    const font = fontKey === "tnr" ? "Times New Roman" : fontKey.replace(/-/g, " ");
    if (font) {
      chain.setFontFamily(font).run();
    }
    return exitCommandMode();
  }
  if (name.startsWith("color-")) {
    const color = toHexColor(name.slice("color-".length));
    if (color) {
      chain.setColor(color).run();
    }
    return exitCommandMode();
  }
  if (name.startsWith("highlight-")) {
    const color = toHexColor(name.slice("highlight-".length));
    if (color) {
      chain.setHighlight({ color }).run();
    }
    return exitCommandMode();
  }
  if (name.startsWith("link-")) {
    const href = name.slice("link-".length);
    if (href) {
      chain.extendMarkRange("link").setLink({ href }).run();
    }
    return exitCommandMode();
  }
  if (name === "unlink") {
    chain.unsetLink().run();
    return exitCommandMode();
  }

  return exitCommandMode();
};
