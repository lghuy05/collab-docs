import assert from "node:assert/strict";
import test from "node:test";

import { Slice } from "@tiptap/pm/model";

import {
  clearActiveRegister,
  isValidRegisterName,
  readRegister,
  selectRegister,
  writeRegister,
} from "./registers";
import { initialVimEngineState } from "./state";

test("selects valid named registers", () => {
  assert.equal(isValidRegisterName("a"), true);
  assert.equal(isValidRegisterName("0"), true);
  assert.equal(isValidRegisterName("%"), false);
  assert.deepEqual(selectRegister("a"), {
    activeRegister: "a",
    pendingRegister: false,
    pendingTokens: [],
  });
});

test("writes named and unnamed yank registers", () => {
  const slice = Slice.empty;
  const selected = { ...initialVimEngineState(), activeRegister: "a" };
  const update = writeRegister(selected, slice, "yank");
  const next = { ...selected, ...update };

  assert.equal(next.registers.a, slice);
  assert.equal(next.registers['"'], slice);
  assert.equal(next.registers["0"], slice);
  assert.equal(readRegister({ ...next, activeRegister: "a" }), slice);
  assert.deepEqual(clearActiveRegister(), { activeRegister: null, pendingRegister: false });
});

test("shifts numbered delete registers", () => {
  const first = Slice.empty;
  const second = new Slice(first.content, 0, 0);
  const state = {
    ...initialVimEngineState(),
    registers: { "1": first },
  };
  const update = writeRegister(state, second, "delete");

  assert.equal(update.registers?.["1"], second);
  assert.equal(update.registers?.["2"], first);
  assert.equal(update.registers?.['"'], second);
});
