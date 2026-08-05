import type { VimCommandDefinition } from "./grammar";

/**
 * The composable core supported by the current editor. Handlers remain in the
 * adapter during migration; this list is the single source for grammar parsing.
 */
export const defaultVimDefinitions: readonly VimCommandDefinition[] = [
  { kind: "operator", keys: "d" },
  { kind: "operator", keys: "c" },
  { kind: "operator", keys: "y" },
  { kind: "motion", keys: "h" },
  { kind: "motion", keys: "j" },
  { kind: "motion", keys: "k" },
  { kind: "motion", keys: "l" },
  { kind: "motion", keys: "w", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "e", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "b", operatorTargets: ["d", "c", "y"] },
  { kind: "motion", keys: "0" },
  { kind: "motion", keys: "^" },
  { kind: "motion", keys: "$" },
  { kind: "motion", keys: "gg" },
  { kind: "motion", keys: "G" },
  { kind: "motion", keys: "d", operatorTargets: ["d"] },
  { kind: "motion", keys: "y", operatorTargets: ["y"] },
  { kind: "textObject", keys: "iw", operatorTargets: ["d", "c", "y"] },
  { kind: "action", keys: "i" },
  { kind: "action", keys: "a" },
  { kind: "action", keys: "o" },
  { kind: "action", keys: "O" },
  { kind: "action", keys: "v" },
  { kind: "action", keys: "V" },
  { kind: "action", keys: "p" },
  { kind: "action", keys: "P" },
  { kind: "action", keys: "u" },
];
