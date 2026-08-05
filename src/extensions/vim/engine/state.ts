import { PluginKey } from "@tiptap/pm/state";

export interface VimEngineState {
  mode: "normal" | "insert" | "visual";
  pendingTokens: string[];
  visualAnchor: number | null;
}

export const vimEnginePluginKey = new PluginKey<VimEngineState>("collabDocsVimEngine");

export const initialVimEngineState = (): VimEngineState => ({
  mode: "insert",
  pendingTokens: [],
  visualAnchor: null,
});

export type VimEngineStateUpdate = Partial<
  Pick<VimEngineState, "mode" | "pendingTokens" | "visualAnchor">
>;
