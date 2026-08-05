/** Public, ProseMirror-level Vim engine API. */
export { defaultVimDefinitions, visualFormattingDefinitions } from "./default-definitions";
export { consumeVimEngineInput, type VimEngineInput } from "./input";
export {
  parseVimTokens,
  type ParsedVimCommand,
  type VimCommandDefinition,
  type VimCommandKind,
  type VimParseResult,
  type VimOperation,
} from "./grammar";
export { createVimEnginePlugin } from "./plugin";
export {
  beginMacroRecording,
  consumeMacroPlayback,
  isRepeatableChange,
  recordCommand,
  recordEditOperation,
  recordExCommand,
  recordInsertText,
  recordKey,
  recordNormalMode,
  requestMacroPlayback,
  stopMacroRecording,
} from "./recording";
export {
  clearActiveRegister,
  isValidMacroRegisterName,
  isValidRegisterName,
  readRegister,
  selectRegister,
  writeRegister,
} from "./registers";
export { createVimRegistry, resolveVimTokens, type VimRegistry } from "./registry";
export {
  initialVimEngineState,
  vimEnginePluginKey,
  type VimEngineState,
  type VimEngineStateUpdate,
} from "./state";
