import { Plugin, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet, EditorView } from "@tiptap/pm/view";

import type { VimModeStorage } from "./types";
import { getNormalRange, isCommandInputKey, updateCommandAttributes } from "./utils";

/** ProseMirror-only view behavior for the Vim extension. */
export const createVimPlugins = (storage: VimModeStorage) => {
  const updateClasses = (element: HTMLElement) => {
    if (!storage.enabled) {
      element.classList.remove("vim-normal-mode", "vim-visual-mode", "vim-insert-mode");
      element.removeAttribute("data-vim-mode");
      element.removeAttribute("data-vim-command");
      element.removeAttribute("data-vim-command-active");
      return;
    }
    element.classList.toggle("vim-normal-mode", storage.mode === "normal");
    element.classList.toggle("vim-visual-mode", storage.mode === "visual");
    element.classList.toggle("vim-insert-mode", storage.mode === "insert");
    element.setAttribute("data-vim-mode", storage.mode);
    updateCommandAttributes(element, storage);
  };

  return [
    new Plugin({
      view: (view) => {
        updateClasses(view.dom as HTMLElement);
        return {
          update: (view) => {
            updateClasses(view.dom as HTMLElement);
            if (!storage.enabled) {
              return;
            }
            if (storage.mode === "normal" && view.state.selection.empty) {
              const pos = view.state.selection.from;
              const { from, to } = getNormalRange(view.state.doc, pos);
              if (from !== view.state.selection.from || to !== view.state.selection.to) {
                view.dispatch(
                  view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to))
                );
              }
            }
            if (
              storage.mode === "normal" &&
              view.state.doc.content.size === 0 &&
              view.state.selection.empty
            ) {
              view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, 0, 0)));
            }
          },
          destroy: () => {
            const element = view.dom as HTMLElement;
            element.classList.remove("vim-normal-mode", "vim-visual-mode", "vim-insert-mode");
            element.removeAttribute("data-vim-mode");
            element.removeAttribute("data-vim-command");
            element.removeAttribute("data-vim-command-active");
          },
        };
      },
      props: {
        handleTextInput: (view: EditorView, _from: number, _to: number, text: string) => {
          if (!storage.enabled) {
            return false;
          }
          if (storage.commandActive) {
            storage.commandBuffer += text;
            storage.commandPaletteQuery = storage.commandBuffer;
            storage.commandSelectionIndex = null;
            updateCommandAttributes(view.dom as HTMLElement, storage);
            return true;
          }
          return storage.mode !== "insert";
        },
        handleKeyDown: (view: EditorView, event: KeyboardEvent) => {
          if (storage.enabled && !storage.commandActive && storage.mode !== "insert" && event.key === ":") {
            storage.commandActive = true;
            storage.commandBuffer = "";
            storage.commandPaletteQuery = "";
            storage.commandSelectionIndex = null;
            updateCommandAttributes(view.dom as HTMLElement, storage);
            return true;
          }
          if (!storage.enabled || !storage.commandActive) {
            return false;
          }
          if (isCommandInputKey(event.key, event)) {
            storage.commandBuffer += event.key;
            storage.commandPaletteQuery = storage.commandBuffer;
            storage.commandSelectionIndex = null;
            updateCommandAttributes(view.dom as HTMLElement, storage);
          }
          return true;
        },
        decorations: (state) => {
          if (!storage.enabled) {
            return null;
          }
          const decorations: Decoration[] = [];
          if (storage.searchQuery) {
            state.doc.descendants((node, pos) => {
              if (!node.isText) {
                return;
              }
              const text = node.text || "";
              let index = text.indexOf(storage.searchQuery);
              while (index !== -1) {
                decorations.push(
                  Decoration.inline(pos + index, pos + index + storage.searchQuery.length, {
                    class: "vim-search-match",
                  })
                );
                index = text.indexOf(storage.searchQuery, index + storage.searchQuery.length);
              }
            });
          }
          if (
            storage.mode === "normal" &&
            state.selection.empty &&
            (state.doc.content.size === 0 ||
              (state.selection.$head.parent.isTextblock &&
                state.selection.$head.parent.content.size === 0))
          ) {
            decorations.push(
              Decoration.widget(state.selection.from, () => {
                const span = document.createElement("span");
                span.className = "vim-block-cursor";
                return span;
              })
            );
          }
          return decorations.length ? DecorationSet.create(state.doc, decorations) : null;
        },
      },
    }),
  ];
};
