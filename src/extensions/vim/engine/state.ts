import { PluginKey } from "@tiptap/pm/state";
import type { Slice } from "@tiptap/pm/model";
import type { VimOperation } from "./grammar";

export interface VimEngineState {
  mode: "normal" | "insert" | "visual" | "visualBlock";
  pendingTokens: string[];
  visualAnchor: number | null;
  pendingRegister: boolean;
  activeRegister: string | null;
  registers: Readonly<Record<string, Slice>>;
  lastChange: readonly VimOperation[] | null;
  recordingChange: boolean;
  pendingMacroRegister: boolean;
  pendingMacroPlayback: boolean;
  pendingMacroCount: number;
  recordingMacro: string | null;
  lastMacroRegister: string | null;
  macros: Readonly<Record<string, readonly VimOperation[]>>;
}

export const vimEnginePluginKey = new PluginKey<VimEngineState>("collabDocsVimEngine");

export const initialVimEngineState = (): VimEngineState => ({
  mode: "insert",
  pendingTokens: [],
  visualAnchor: null,
  pendingRegister: false,
  activeRegister: null,
  registers: {},
  lastChange: null,
  recordingChange: false,
  pendingMacroRegister: false,
  pendingMacroPlayback: false,
  pendingMacroCount: 1,
  recordingMacro: null,
  lastMacroRegister: null,
  macros: {},
});

export type VimEngineStateUpdate = Partial<
  Pick<
    VimEngineState,
    | "mode"
    | "pendingTokens"
    | "visualAnchor"
    | "pendingRegister"
    | "activeRegister"
    | "registers"
    | "lastChange"
    | "recordingChange"
    | "pendingMacroRegister"
    | "pendingMacroPlayback"
    | "pendingMacroCount"
    | "recordingMacro"
    | "lastMacroRegister"
    | "macros"
  >
>;
