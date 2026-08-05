import assert from "node:assert/strict";
import test from "node:test";

import { Schema } from "@tiptap/pm/model";
import { EditorState } from "@tiptap/pm/state";

import { createVimEnginePlugin } from "./plugin";
import { vimEnginePluginKey } from "./state";

const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: { content: "text*", group: "block" },
    text: { group: "inline" },
  },
});

test("maps a Visual anchor through a document transaction", () => {
  let state = EditorState.create({
    schema,
    doc: schema.node("doc", undefined, [
      schema.node("paragraph", undefined, schema.text("hello")),
    ]),
    plugins: [createVimEnginePlugin()],
  });

  state = state.apply(
    state.tr.setMeta(vimEnginePluginKey, {
      mode: "visual",
      visualAnchor: 3,
    })
  );
  state = state.apply(state.tr.insertText("X", 1));

  assert.deepEqual(vimEnginePluginKey.getState(state), {
    mode: "visual",
    pendingTokens: [],
    visualAnchor: 4,
  });
});
