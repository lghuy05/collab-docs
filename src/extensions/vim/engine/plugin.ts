import type { Slice } from "@tiptap/pm/model";
import { Plugin, type Transaction } from "@tiptap/pm/state";

import {
  initialVimEngineState,
  type VimEngineStateUpdate,
  vimEnginePluginKey,
} from "./state";
import { recordInsertText, vimMacroReplayMeta } from "./recording";

const getInsertedText = (transaction: Transaction) => {
  let text = "";
  for (const step of transaction.steps) {
    const slice = (step as { slice?: Slice }).slice;
    if (slice?.content.size) {
      text += slice.content.textBetween(0, slice.content.size, "\n", "\n");
    }
  }
  return text;
};

/**
 * Local-only state for the registry-driven Vim engine.
 *
 * The existing Tiptap adapter will migrate mode changes and key dispatch to
 * this plugin incrementally. Mapping the visual anchor here is important for
 * collaborative transactions, where remote edits shift document positions.
 */
export const createVimEnginePlugin = () =>
  new Plugin({
    key: vimEnginePluginKey,
    state: {
      init: initialVimEngineState,
      apply(transaction, previous) {
        const update = transaction.getMeta(vimEnginePluginKey) as VimEngineStateUpdate | undefined;
        let next = update ? { ...previous, ...update } : previous;
        if (
          transaction.docChanged &&
          previous.mode === "insert" &&
          previous.recordingMacro &&
          !transaction.getMeta(vimMacroReplayMeta)
        ) {
          const text = getInsertedText(transaction);
          if (text) {
            next = { ...next, ...recordInsertText(next, text) };
          }
        }
        if (!transaction.docChanged || next.visualAnchor == null) {
          return next;
        }
        return {
          ...next,
          visualAnchor: transaction.mapping.map(next.visualAnchor),
        };
      },
    },
  });
