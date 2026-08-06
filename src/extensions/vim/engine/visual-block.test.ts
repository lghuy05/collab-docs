import assert from "node:assert/strict";
import test from "node:test";

import { Schema } from "@tiptap/pm/model";

import { getVisualBlockRanges } from "../utils";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
  },
});

test("builds a rectangular range across text blocks", () => {
  const doc = schema.node("doc", undefined, [
    schema.node("paragraph", undefined, schema.text("alpha")),
    schema.node("paragraph", undefined, schema.text("bravo")),
    schema.node("paragraph", undefined, schema.text("cat")),
  ]);

  // Column 1 of alpha through column 2 of cat, inclusive.
  assert.deepEqual(getVisualBlockRanges(doc, 2, 17), [
    { from: 2, to: 4 },
    { from: 9, to: 11 },
    { from: 16, to: 18 },
  ]);
});
