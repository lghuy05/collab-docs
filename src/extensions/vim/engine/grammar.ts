export type VimCommandKind = "action" | "motion" | "operator" | "textObject";

export interface VimCommandDefinition {
  keys: string;
  kind: VimCommandKind;
  /** Operators that may use this motion/text object as their target. */
  operatorTargets?: readonly string[];
}

export interface ParsedVimCommand {
  count: number;
  operator?: string;
  target?: string;
  action?: string;
}

export type VimOperation =
  | { type: "command"; command: ParsedVimCommand }
  | { type: "key"; key: string }
  | { type: "insertText"; text: string }
  | { type: "deleteBackward" }
  | { type: "deleteForward" }
  | { type: "splitBlock" }
  | { type: "exCommand"; command: string }
  | { type: "enterNormalMode" };

export type VimParseResult =
  | { status: "pending" }
  | { status: "invalid" }
  | { status: "complete"; command: ParsedVimCommand };

const splitCount = (tokens: readonly string[]) => {
  let index = 0;
  let count = "";
  while (index < tokens.length && /^\d$/u.test(tokens[index])) {
    if (count || tokens[index] !== "0") {
      count += tokens[index];
    } else {
      break;
    }
    index += 1;
  }
  return { count: Number(count) || 1, remaining: tokens.slice(index) };
};

const matchingDefinitions = (
  tokens: readonly string[],
  definitions: readonly VimCommandDefinition[]
) => definitions.filter((definition) => definition.keys.startsWith(tokens.join("")));

/**
 * Parses the composable subset of Vim grammar:
 *
 *   [count] action
 *   [count] motion
 *   [count] operator (motion | text object)
 */
export const parseVimTokens = (
  tokens: readonly string[],
  definitions: readonly VimCommandDefinition[]
): VimParseResult => {
  const { count, remaining } = splitCount(tokens);
  if (!remaining.length) {
    return { status: "pending" };
  }

  const joined = remaining.join("");
  const operators = definitions.filter((definition) => definition.kind === "operator");
  const operator = operators.find((definition) => joined.startsWith(definition.keys));

  if (operator) {
    const targetTokens = remaining.slice(operator.keys.length);
    if (!targetTokens.length) {
      return { status: "pending" };
    }
    const targets = definitions.filter(
      (definition) =>
        (definition.kind === "motion" || definition.kind === "textObject") &&
        definition.operatorTargets?.includes(operator.keys)
    );
    const exact = targets.find((definition) => definition.keys === targetTokens.join(""));
    if (exact) {
      return {
        status: "complete",
        command: { count, operator: operator.keys, target: exact.keys },
      };
    }
    return matchingDefinitions(targetTokens, targets).length
      ? { status: "pending" }
      : { status: "invalid" };
  }

  const actionsAndMotions = definitions.filter(
    (definition) => definition.kind === "action" || definition.kind === "motion"
  );
  const exact = actionsAndMotions.find((definition) => definition.keys === joined);
  if (exact) {
    return {
      status: "complete",
      command: exact.kind === "action"
        ? { count, action: exact.keys }
        : { count, target: exact.keys },
    };
  }
  return matchingDefinitions(remaining, actionsAndMotions).length
    ? { status: "pending" }
    : { status: "invalid" };
};
