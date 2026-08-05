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

Common edits include `dd`, `dw`, `ciw`, `x`, `X`, `D`, `C`, `s`, `S`, `r{character}`, `J`, `p`, and `P`. Count prefixes work with core motions and word operators, for example `3w`, `5j`, and `2dw`.

This is Vim-compatible rich-document editing, not a full terminal Vim implementation. Commands that require plain-text buffers, terminal windows, macros, or visual block columns are intentionally not presented as supported behavior.
