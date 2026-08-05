import type { VimCommandDefinition, VimCommandKind } from "./grammar";
import { parseVimTokens, type ParsedVimCommand, type VimParseResult } from "./grammar";

export type VimCommandHandler<Context> = (
  context: Context,
  command: ParsedVimCommand
) => boolean;

export interface VimRegistry<Context> {
  definitions: readonly VimCommandDefinition[];
  handlers: ReadonlyMap<string, VimCommandHandler<Context>>;
}

export const createVimRegistry = <Context>() => {
  const definitions: VimCommandDefinition[] = [];
  const handlers = new Map<string, VimCommandHandler<Context>>();

  const register = (
    kind: VimCommandKind,
    keys: string,
    handler: VimCommandHandler<Context>
  ) => {
    definitions.push({ kind, keys });
    handlers.set(`${kind}:${keys}`, handler);
  };

  return {
    registerAction: (keys: string, handler: VimCommandHandler<Context>) =>
      register("action", keys, handler),
    registerMotion: (keys: string, handler: VimCommandHandler<Context>) =>
      register("motion", keys, handler),
    registerOperator: (keys: string, handler: VimCommandHandler<Context>) =>
      register("operator", keys, handler),
    registerTextObject: (keys: string, handler: VimCommandHandler<Context>) =>
      register("textObject", keys, handler),
    build: (): VimRegistry<Context> => ({ definitions, handlers }),
  };
};

export const resolveVimTokens = <Context>(
  registry: VimRegistry<Context>,
  tokens: readonly string[]
): VimParseResult => parseVimTokens(tokens, registry.definitions);
