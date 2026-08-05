import type { Slice } from "@tiptap/pm/model";

import type { VimEngineState, VimEngineStateUpdate } from "./state";

export type VimRegisterName = '"' | '0' | '-' | string;

const MAX_NUMBERED_DELETE_REGISTERS = 9;

export const isValidRegisterName = (value: string) => /^[a-z0-9"-]$/iu.test(value);

/** Macro recording uses Vim's named registers, digits, and the unnamed register. */
export const isValidMacroRegisterName = (value: string) => /^[a-z0-9"]$/iu.test(value);

export const selectRegister = (name: string): VimEngineStateUpdate => ({
  activeRegister: name,
  pendingRegister: false,
  pendingTokens: [],
});

export const clearActiveRegister = (): VimEngineStateUpdate => ({
  activeRegister: null,
  pendingRegister: false,
});

/** Writes an unnamed register and, for deletes, shifts numbered registers. */
export const writeRegister = (
  state: VimEngineState,
  slice: Slice,
  kind: "yank" | "delete"
): VimEngineStateUpdate => {
  const registers = { ...state.registers } as Record<string, Slice>;
  const destination = state.activeRegister ?? '"';
  registers[destination] = slice;
  registers['"'] = slice;
  if (kind === "yank") {
    registers["0"] = slice;
  } else {
    for (let index = MAX_NUMBERED_DELETE_REGISTERS; index >= 2; index -= 1) {
      const previous = registers[String(index - 1)];
      if (previous) {
        registers[String(index)] = previous;
      }
    }
    registers["1"] = slice;
  }
  return { registers, ...clearActiveRegister() };
};

export const readRegister = (state: VimEngineState): Slice | null =>
  state.registers[state.activeRegister ?? '"'] ?? null;
