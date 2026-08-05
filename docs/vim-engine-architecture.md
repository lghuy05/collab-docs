# Vim engine architecture

The editor keeps Tiptap for document schema, rich-text commands, and the
Liveblocks collaboration integration. Vim input is implemented as a local
ProseMirror engine mounted by the Tiptap extension.

The reusable API is exported from `src/extensions/vim/engine/index.ts`.

## Layers

- `vim/engine/grammar.ts` parses composable input such as `2w`, `gg`, `dw`,
  `ce`, and `yiw`.
- `vim/engine/state.ts` defines the ProseMirror plugin state: mode, pending
  tokens, and the visual anchor.
- `vim/engine/plugin.ts` maps the visual anchor through every document
  transaction. This is important when collaborative changes move text while a
  user has Visual mode active.
- `vim/engine/input.ts` consumes one normal-mode key using only ProseMirror
  state and a supplied command executor. It has no Tiptap dependency.
- `vim/keybindings.ts` is the Tiptap adapter. It provides editor-specific
  implementations for parsed commands, including rich-text-safe editing,
  selections, and the document clipboard.
- `vim/plugins.ts` mounts the engine and continues to own view decorations and
  the Ex-command UI plumbing.

## Command flow

```text
keypress → Tiptap keybinding adapter → ProseMirror engine state
         → parsed Vim command → Tiptap command executor → transaction
```

For example, `d`, `w` becomes the token sequence `["d", "w"]`. The engine
parses it as the `d` operator applied to the `w` motion, clears pending tokens,
and delegates the edit to the adapter. A lone `d` remains pending in plugin
state; it does not rely on an extension-storage timeout.

## Extending it

Add a definition to `default-definitions.ts` for syntax, then add the command
implementation in the adapter. Commands that depend on Tiptap features—such
as marks, font family, tables, comments, or Ex commands—should stay in the
adapter. Generic parsing, pending input, mapping, and selection state belong
in `vim/engine`.

The next migration steps are to move more motions/operators into the registry
and replace the remaining legacy pending-key fields one command family at a
time. This preserves current behavior while avoiding a risky all-at-once Vim
rewrite.
