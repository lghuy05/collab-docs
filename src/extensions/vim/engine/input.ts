import type { EditorState, Transaction } from "@tiptap/pm/state";

import { defaultVimDefinitions } from "./default-definitions";
import {
  parseVimTokens,
  type ParsedVimCommand,
  type VimCommandDefinition,
} from "./grammar";
import { vimEnginePluginKey } from "./state";

export interface VimEngineInput {
  enabled: boolean;
  mode: "normal" | "insert" | "visual" | "visualBlock";
  commandActive: boolean;
  state: EditorState;
  dispatch: (transaction: Transaction) => void;
  definitions?: readonly VimCommandDefinition[];
  acceptedModes?: readonly VimEngineInput["mode"][];
}

/**
 * Handles the grammar portion of a normal-mode keypress. The host supplies
 * the command executor, so this module stays independent of Tiptap commands
 * and can be mounted by any ProseMirror integration.
 */
export const consumeVimEngineInput = (
  input: VimEngineInput,
  key: string,
  execute: (command: ParsedVimCommand) => boolean
): boolean | null => {
  if (
    !input.enabled ||
    input.commandActive ||
    !(input.acceptedModes ?? ["normal"]).includes(input.mode) ||
    key.length !== 1
  ) {
    return null;
  }

  const engineState = vimEnginePluginKey.getState(input.state);
  const tokens = [...(engineState?.pendingTokens ?? []), key];
  const result = parseVimTokens(tokens, input.definitions ?? defaultVimDefinitions);
  if (result.status === "invalid") {
    if (engineState?.pendingTokens.length) {
      input.dispatch(input.state.tr.setMeta(vimEnginePluginKey, { pendingTokens: [] }));
    }
    return null;
  }
  if (result.status === "pending") {
    input.dispatch(input.state.tr.setMeta(vimEnginePluginKey, { pendingTokens: tokens }));
    return true;
  }

  input.dispatch(input.state.tr.setMeta(vimEnginePluginKey, { pendingTokens: [] }));
  return execute(result.command);
};
