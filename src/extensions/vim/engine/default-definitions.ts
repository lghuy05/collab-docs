import type { VimCommandDefinition } from "./grammar";

/**
 * The composable core supported by the current editor. Handlers remain in the
 * adapter during migration; this list is the single source for grammar parsing.
 */
export const defaultVimDefinitions: readonly VimCommandDefinition[] = [
  { kind: "operator", keys: "d" },
  { kind: "operator", keys: "c" },
  { kind: "operator", keys: "y" },
  { kind: "motion", keys: "h", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "j", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "k", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "l", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "w", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "e", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "b", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "0", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "^", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "$", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "gg", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "G", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "d", operatorTargets: ["d"] },
  { kind: "motion", keys: "c", operatorTargets: ["c"] },
  { kind: "motion", keys: "y", operatorTargets: ["y"] },
  { kind: "textObject", keys: "iw", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "aw", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "i\"", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "a\"", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "i'", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "a'", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "i(", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "a(", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "i[", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "a[", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "i{", operatorTargets: ["d", "c", "y"] },
  { kind: "textObject", keys: "a{", operatorTargets: ["d", "c", "y"] },
  { kind: "action", keys: "i" },
  { kind: "action", keys: "a" },
  { kind: "action", keys: "I" },
  { kind: "action", keys: "A" },
  { kind: "action", keys: "o" },
  { kind: "action", keys: "O" },
  { kind: "action", keys: "v" },
  { kind: "action", keys: "V" },
  { kind: "action", keys: "p" },
  { kind: "action", keys: "P" },
  { kind: "action", keys: "u" },
  { kind: "action", keys: "." },
  { kind: "action", keys: "gb" },
  { kind: "action", keys: "gi" },
  { kind: "action", keys: "gu" },
  { kind: "action", keys: "gp" },
  { kind: "action", keys: "g1" },
  { kind: "action", keys: "g2" },
  { kind: "action", keys: "g3" },
  { kind: "action", keys: "g4" },
  { kind: "action", keys: "g5" },
  { kind: "action", keys: "gc" },
];

/** Actions that are meaningful against a Visual-mode text selection. */
export const visualFormattingDefinitions = defaultVimDefinitions.filter(
  (definition) => definition.kind === "action" && definition.keys.startsWith("g")
);
