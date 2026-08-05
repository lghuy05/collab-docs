import type { ParsedVimCommand, VimOperation } from "./grammar";
import type { VimEngineState, VimEngineStateUpdate } from "./state";

/** Marks transactions generated while replaying a macro. */
export const vimMacroReplayMeta = "collabDocsVimMacroReplay";

export const isRepeatableChange = (command: ParsedVimCommand) =>
  command.operator === "c" ||
  command.operator === "d" ||
  ["i", "a", "I", "A", "o", "O", "p", "P"].includes(command.action ?? "");

const keepsRecordingInsertedText = (command: ParsedVimCommand) =>
  command.operator === "c" || ["i", "a", "I", "A", "o", "O"].includes(command.action ?? "");

export const recordCommand = (
  state: VimEngineState,
  command: ParsedVimCommand
): VimEngineStateUpdate => {
  const operation: VimOperation = { type: "command", command };
  const update: VimEngineStateUpdate = isRepeatableChange(command)
    ? { lastChange: [operation], recordingChange: keepsRecordingInsertedText(command) }
    : {};
  if (!state.recordingMacro) {
    return update;
  }
  return update;
};

/** Records a normalized Vim key so replay uses the same input dispatcher. */
export const recordKey = (state: VimEngineState, key: string): VimEngineStateUpdate => {
  if (!state.recordingMacro) {
    return {};
  }
  const macros = { ...state.macros } as Record<string, readonly VimOperation[]>;
  macros[state.recordingMacro] = [
    ...(macros[state.recordingMacro] ?? []),
    { type: "key", key },
  ];
  return { macros };
};

export const recordInsertText = (
  state: VimEngineState,
  text: string
): VimEngineStateUpdate => {
  if (!text) {
    return {};
  }
  const update: VimEngineStateUpdate = {};
  if (state.recordingMacro) {
    const macros = { ...state.macros } as Record<string, readonly VimOperation[]>;
    const steps = [...(macros[state.recordingMacro] ?? [])];
    const last = steps.at(-1);
    if (last && "type" in last && last.type === "insertText") {
      steps[steps.length - 1] = { type: "insertText", text: last.text + text };
    } else {
      steps.push({ type: "insertText", text });
    }
    macros[state.recordingMacro] = steps;
    update.macros = macros;
  }
  const lastChange = state.recordingChange && state.lastChange
    ? [...state.lastChange, { type: "insertText" as const, text }]
    : state.lastChange;
  return { ...update, lastChange };
};

/** Records an Insert-mode editing operation for macro and dot-repeat replay. */
export const recordEditOperation = (
  state: VimEngineState,
  operation: Extract<VimOperation, { type: "deleteBackward" | "deleteForward" | "splitBlock" }>
): VimEngineStateUpdate => {
  const update: VimEngineStateUpdate = {};
  if (state.recordingMacro) {
    const macros = { ...state.macros } as Record<string, readonly VimOperation[]>;
    macros[state.recordingMacro] = [...(macros[state.recordingMacro] ?? []), operation];
    update.macros = macros;
  }
  if (state.recordingChange && state.lastChange) {
    update.lastChange = [...state.lastChange, operation];
  }
  return update;
};

/** Ex commands are replayable in macros, but intentionally excluded from dot-repeat. */
export const recordExCommand = (state: VimEngineState, command: string): VimEngineStateUpdate => {
  if (!state.recordingMacro || !command) {
    return {};
  }
  const macros = { ...state.macros } as Record<string, readonly VimOperation[]>;
  macros[state.recordingMacro] = [
    ...(macros[state.recordingMacro] ?? []),
    { type: "exCommand", command },
  ];
  return { macros };
};

export const recordNormalMode = (state: VimEngineState): VimEngineStateUpdate => {
  const lastChange = state.recordingChange && state.lastChange
    ? [...state.lastChange, { type: "enterNormalMode" as const }]
    : state.lastChange;
  return { lastChange, recordingChange: false };
};

export const beginMacroRecording = (
  state: VimEngineState,
  name: string
): VimEngineStateUpdate => {
  const register = name.toLowerCase();
  const append = name !== register;
  return {
    pendingMacroRegister: false,
    recordingMacro: register,
    macros: {
      ...state.macros,
      [register]: append ? (state.macros[register] ?? []) : [],
    },
  };
};

export const stopMacroRecording = (): VimEngineStateUpdate => ({
  recordingMacro: null,
  pendingMacroRegister: false,
});

export const requestMacroPlayback = (count = 1): VimEngineStateUpdate => ({
  pendingMacroPlayback: true,
  pendingMacroCount: count,
  pendingTokens: [],
});

export const consumeMacroPlayback = (
  state: VimEngineState,
  name: string
): { commands: readonly VimOperation[]; update: VimEngineStateUpdate } => ({
  commands: state.macros[name.toLowerCase()] ?? [],
  update: {
    pendingMacroPlayback: false,
    pendingMacroCount: 1,
    lastMacroRegister: name.toLowerCase(),
  },
});
