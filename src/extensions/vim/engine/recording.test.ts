import assert from "node:assert/strict";
import test from "node:test";

import {
  beginMacroRecording,
  consumeMacroPlayback,
  isRepeatableChange,
  recordCommand,
  recordEditOperation,
  recordInsertText,
  recordKey,
  recordNormalMode,
  requestMacroPlayback,
  stopMacroRecording,
} from "./recording";
import { initialVimEngineState } from "./state";

const deleteWord = { count: 1, operator: "d", target: "w" } as const;

test("recognizes repeatable structured changes", () => {
  assert.equal(isRepeatableChange(deleteWord), true);
  assert.equal(isRepeatableChange({ count: 1, target: "w" }), false);
  assert.equal(isRepeatableChange({ count: 1, action: "p" }), true);
});

test("records normalized keys into the active macro and changes separately", () => {
  const initial = initialVimEngineState();
  const recording = { ...initial, ...beginMacroRecording(initial, "a") };
  const update = recordCommand(recording, deleteWord);
  const next = { ...recording, ...update };
  const keyed = { ...next, ...recordKey(next, "d") };

  assert.deepEqual(next.lastChange, [{ type: "command", command: deleteWord }]);
  assert.deepEqual(keyed.macros.a, [{ type: "key", key: "d" }]);
  assert.deepEqual(stopMacroRecording(), {
    recordingMacro: null,
    pendingMacroRegister: false,
  });
});

test("records macro motions without replacing dot-repeat state", () => {
  const priorChange = { count: 1, operator: "d", target: "w" } as const;
  const recording = {
    ...initialVimEngineState(),
    lastChange: [{ type: "command" as const, command: priorChange }],
    recordingMacro: "a",
  };
  const motion = { count: 1, target: "j" } as const;
  const update = recordCommand(recording, motion);
  const keyed = { ...recording, ...recordKey(recording, "j") };

  assert.equal(update.lastChange, undefined);
  assert.deepEqual(keyed.macros.a, [{ type: "key", key: "j" }]);
});

test("returns a recorded macro for replay and clears playback state", () => {
  const state = {
    ...initialVimEngineState(),
    pendingMacroPlayback: true,
    macros: { a: [{ type: "command" as const, command: deleteWord }] },
  };
  const playback = consumeMacroPlayback(state, "a");

  assert.deepEqual(playback.commands, [{ type: "command", command: deleteWord }]);
  assert.deepEqual(playback.update, {
    pendingMacroPlayback: false,
    pendingMacroCount: 1,
    lastMacroRegister: "a",
  });
});

test("keeps Vim macro count and @@ repeat state", () => {
  assert.deepEqual(requestMacroPlayback(2), {
    pendingMacroPlayback: true,
    pendingMacroCount: 2,
    pendingTokens: [],
  });

  const state = {
    ...initialVimEngineState(),
    pendingMacroPlayback: true,
    lastMacroRegister: "a",
    macros: { a: [{ type: "key" as const, key: "j" }] },
  };
  const playback = consumeMacroPlayback(state, state.lastMacroRegister);
  assert.deepEqual(playback.commands, [{ type: "key", key: "j" }]);
  assert.equal(playback.update.lastMacroRegister, "a");
});

test("appends uppercase macro recordings and records Insert-mode edit keys", () => {
  const initial = {
    ...initialVimEngineState(),
    macros: { a: [{ type: "key" as const, key: "j" }] },
  };
  const recording = { ...initial, ...beginMacroRecording(initial, "A") };
  const updated = { ...recording, ...recordEditOperation(recording, { type: "deleteBackward" }) };

  assert.equal(recording.recordingMacro, "a");
  assert.deepEqual(updated.macros.a, [
    { type: "key", key: "j" },
    { type: "deleteBackward" },
  ]);
});

test("records consecutive Insert-mode text and a return to Normal mode", () => {
  const recording = {
    ...initialVimEngineState(),
    recordingMacro: "a",
  };
  const first = { ...recording, ...recordInsertText(recording, "hello") };
  const second = { ...first, ...recordInsertText(first, "!") };
  const complete = { ...second, ...recordNormalMode(second) };

  assert.deepEqual(complete.macros.a, [
    { type: "insertText", text: "hello!" },
  ]);
});

test("builds a replayable change sequence for Insert-mode edits", () => {
  const initial = initialVimEngineState();
  const enteredInsert = {
    ...initial,
    ...recordCommand(initial, { count: 1, action: "A" }),
  };
  const inserted = {
    ...enteredInsert,
    ...recordInsertText(enteredInsert, "."),
  };
  const complete = {
    ...inserted,
    ...recordNormalMode(inserted),
  };

  assert.deepEqual(complete.lastChange, [
    { type: "command", command: { count: 1, action: "A" } },
    { type: "insertText", text: "." },
    { type: "enterNormalMode" },
  ]);
  assert.equal(complete.recordingChange, false);
});
