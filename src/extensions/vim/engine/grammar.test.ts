import assert from "node:assert/strict";
import test from "node:test";

import {
  defaultVimDefinitions,
  visualFormattingDefinitions,
} from "./default-definitions";
import { parseVimTokens } from "./grammar";

const parse = (keys: string) => parseVimTokens([...keys], defaultVimDefinitions);

test("keeps incomplete operator sequences pending", () => {
  assert.deepEqual(parse("d"), { status: "pending" });
  assert.deepEqual(parse("ci"), { status: "pending" });
  assert.deepEqual(parse("g"), { status: "pending" });
});

test("parses counted motions and line operators", () => {
  assert.deepEqual(parse("3w"), {
    status: "complete",
    command: { count: 3, target: "w" },
  });
  assert.deepEqual(parse("2d$"), {
    status: "complete",
    command: { count: 2, operator: "d", target: "$" },
  });
  assert.deepEqual(parse("cc"), {
    status: "complete",
    command: { count: 1, operator: "c", target: "c" },
  });
  assert.deepEqual(parse("dj"), {
    status: "complete",
    command: { count: 1, operator: "d", target: "j" },
  });
});

test("parses word and paired text objects", () => {
  assert.deepEqual(parse("caw"), {
    status: "complete",
    command: { count: 1, operator: "c", target: "aw" },
  });
  assert.deepEqual(parse('di"'), {
    status: "complete",
    command: { count: 1, operator: "d", target: 'i"' },
  });
  assert.deepEqual(parse("ya("), {
    status: "complete",
    command: { count: 1, operator: "y", target: "a(" },
  });
});

test("parses Collab Docs rich-formatting shortcuts", () => {
  assert.deepEqual(parse("gb"), {
    status: "complete",
    command: { count: 1, action: "gb" },
  });
  assert.deepEqual(parse("g3"), {
    status: "complete",
    command: { count: 1, action: "g3" },
  });
});

test("limits Visual-mode parsing to formatting actions", () => {
  assert.deepEqual(parseVimTokens(["g"], visualFormattingDefinitions), {
    status: "pending",
  });
  assert.deepEqual(parseVimTokens(["g", "b"], visualFormattingDefinitions), {
    status: "complete",
    command: { count: 1, action: "gb" },
  });
  assert.deepEqual(parseVimTokens(["w"], visualFormattingDefinitions), {
    status: "invalid",
  });
});

test("rejects unsupported operator targets", () => {
  assert.deepEqual(parse("d"), { status: "pending" });
  assert.deepEqual(parse("df"), { status: "invalid" });
});
