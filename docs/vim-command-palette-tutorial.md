# Vim command palette tutorial

Collab Docs combines Vim-style editing with rich document commands. Press `:` from Normal or Visual mode to open the command palette.

## Navigate the palette

Type part of a command to filter the list. The focused suggestion replaces the visible command buffer, so you can immediately add an argument.

| Key | Action |
| --- | --- |
| `Tab` or `↓` | Select the next suggestion |
| `Shift+Tab` or `↑` | Select the previous suggestion |
| `Enter` | Run the current command |
| `Esc` | Close the palette |

For example, type `:fon`, press `Tab` to complete `:font`, then type a space to see font-family suggestions. Choose `Times New Roman` and press `Enter`.

## Document commands

The palette suggests valid values after these commands:

```text
:font Times New Roman
:font-size 14
:line-height 1.5
:align center
:heading 2
:color #2563eb
:highlight #fef08a
:image https://example.com/diagram.png
```

Formatting commands apply to the current selection or future inserted text. Structure commands include `:bullet`, `:ordered`, `:task`, and `:paragraph`. Use `:image <url>` to insert an image and `:comment` with selected text to start a Liveblocks collaborative comment. If a command has no match, the palette says so instead of silently showing an empty list.

## Vim-compatible editing

Vim mode starts in Insert mode. Press `Esc` for Normal mode, then use motions such as `h`, `j`, `k`, `l`, `w`, `e`, `b`, `0`, `^`, `$`, `gg`, and `G`.

Common edits include `dd`, `cc`, `dw`, `d$`, `d0`, `dj`, `ciw`, `caw`, `di"`, `da(`, `x`, `X`, `D`, `C`, `s`, `S`, `r{character}`, `J`, `p`, and `P`. Text objects support words, quotes, parentheses, brackets, and braces. Count prefixes work with core motions and word operators, for example `3w`, `5j`, and `2dw`.

## Keyboard-first formatting

Use the command palette for discoverable rich-text commands, or use these
`g`-prefixed document shortcuts when you want to stay on the keyboard. For
formatting, first select text with `v` or an entire line with `V`; for example,
`V` then `gb` bolds the line.

| Key | Action |
| --- | --- |
| `gb` | Toggle bold |
| `gi` | Toggle italic |
| `gu` | Toggle underline |
| `g1` … `g5` | Toggle heading level 1 … 5 |
| `gp` | Convert the current block to a paragraph |
| `gc` | Start a collaborative comment |

These are Collab Docs additions, so they intentionally use Tiptap commands
after the ProseMirror Vim engine has parsed the key sequence. In Normal mode,
they affect the current cursor selection; Visual mode is the recommended way
to format a meaningful range.

## Registers, repeat, and macros

Yanks and deletes now write to local Vim registers. The unnamed register (`"`)
is used by `p` and `P`; yanks are also stored in `0`, while deletes shift
through numbered registers. Use a register prefix to target a named register:

```text
"ayy     # yank into register a
"ap      # paste from register a
```

Repeat a structured edit with `.`. The engine currently repeats parsed edits
such as `dw`, `cc`, `d$`, `o`, and `p`.

Macros record normalized Vim input and replay it through the same key
dispatcher: use `qa` to start recording into register `a`, `q` to stop, and
`@a` to replay. `2@a` repeats it twice, `@@` repeats the last executed macro,
and `qA` appends to the existing `a` macro. This includes motions, counts,
character arguments such as `f{char}` and `t{char}`, Insert-mode text,
Backspace, Delete, Enter, Escape, and supported Ex commands. For example,
`qaA.<Esc>j0q` records appending a period, returning to Normal mode, moving
down, and returning to the start of the next line. Macro state is local to
your editor session.

The macro key stream is deliberately separate from rich-document register
content. Named registers used by `"ay` / `"ap` hold Tiptap document slices;
named macro registers hold replayable editor operations. That keeps a macro
safe across collaborative position remapping, but differs from terminal Vim,
where a named register can be treated as either text or macro characters.

This is Vim-compatible rich-document editing, not a full terminal Vim implementation. Commands that require terminal windows, arbitrary script execution, or visual block columns are intentionally not presented as supported behavior.
