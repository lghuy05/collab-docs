import { Plugin } from "@tiptap/pm/state";

import {
  initialVimEngineState,
  type VimEngineStateUpdate,
  vimEnginePluginKey,
} from "./state";

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
        const next = update ? { ...previous, ...update } : previous;
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
