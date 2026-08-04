export interface VimCommandDefinition {
  name: string;
  aliases?: string[];
  description: string;
  usage?: string;
  category: "vim" | "format" | "document" | "collaboration";
}

export interface VimCommandSuggestion extends VimCommandDefinition {
  completion: string;
}

const fontFamilies = [
  "Arial",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Verdana",
];

const commandArguments: Record<string, readonly string[]> = {
  align: ["left", "center", "right", "justify"],
  "font-size": ["10", "12", "14", "16", "18", "20", "24", "32"],
  "line-height": ["1", "1.15", "1.5", "2", "normal"],
  heading: ["1", "2", "3", "4", "5"],
  color: ["#000000", "#2563eb", "#dc2626", "#16a34a", "#9333ea"],
  highlight: ["#fef08a", "#bbf7d0", "#bfdbfe", "#fecaca", "#e9d5ff"],
};

/**
 * The commands currently understood by the Ex executor. Keeping this public
 * catalogue independent of the executor lets the command palette, help UI,
 * and future user mappings share one source of truth.
 */
export const vimCommandRegistry: readonly VimCommandDefinition[] = [
  { name: "quit", aliases: ["q"], description: "Return to the document list", category: "vim" },
  { name: "noh", aliases: ["nohl", "nohlsearch"], description: "Clear search highlighting", category: "vim" },
  { name: "undo", aliases: ["u"], description: "Undo the last edit", category: "vim" },
  { name: "redo", description: "Redo the last undone edit", category: "vim" },
  { name: "vim", description: "Toggle Vim mode", category: "vim" },
  { name: "bold", description: "Toggle bold", category: "format" },
  { name: "italic", description: "Toggle italic", category: "format" },
  { name: "underline", description: "Toggle underline", category: "format" },
  { name: "clean", aliases: ["clear", "remove"], description: "Remove all text formatting", category: "format" },
  { name: "heading-1", aliases: ["h1"], description: "Toggle heading level 1", category: "format" },
  { name: "heading-2", aliases: ["h2"], description: "Toggle heading level 2", category: "format" },
  { name: "heading-3", aliases: ["h3"], description: "Toggle heading level 3", category: "format" },
  { name: "heading-4", aliases: ["h4"], description: "Toggle heading level 4", category: "format" },
  { name: "heading-5", aliases: ["h5"], description: "Toggle heading level 5", category: "format" },
  { name: "paragraph", aliases: ["p", "normal"], description: "Change block to a paragraph", category: "format" },
  { name: "bullet", aliases: ["bullets", "ul"], description: "Toggle a bullet list", category: "document" },
  { name: "ordered", aliases: ["ol"], description: "Toggle an ordered list", category: "document" },
  { name: "todo", aliases: ["task"], description: "Toggle a task list", category: "document" },
  { name: "align", usage: "align <left|center|right|justify>", description: "Set paragraph alignment", category: "format" },
  { name: "font-size", usage: "font-size <px>", description: "Set font size", category: "format" },
  { name: "line-height", usage: "line-height <value>", description: "Set line height", category: "format" },
  { name: "font", usage: "font <family>", description: "Set font family", category: "format" },
  { name: "color", usage: "color <#rrggbb>", description: "Set text color", category: "format" },
  { name: "highlight", usage: "highlight <#rrggbb>", description: "Set highlight color", category: "format" },
  { name: "link", usage: "link <url>", description: "Apply a link", category: "document" },
  { name: "unlink", description: "Remove the current link", category: "document" },
  { name: "image", usage: "image <url>", description: "Insert an image from a URL", category: "document" },
  { name: "comment", description: "Add a collaborative comment", category: "collaboration" },
  { name: "print", description: "Print the document", category: "document" },
  { name: "spell", description: "Toggle browser spellcheck", category: "document" },
  { name: "replace", aliases: ["rp"], description: "Replace the current selection", category: "vim" },
];

export const getVimCommandSuggestions = (input: string, limit = 6) => {
  const query = input.replace(/^:/, "").trim().toLowerCase();
  const commandName = query.split(/\s+/, 1)[0];
  const argument = query.slice(commandName.length).trim();

  if (commandName === "font" && /\s/u.test(input.replace(/^:/, ""))) {
    return fontFamilies
      .filter((family) => family.toLowerCase().startsWith(argument))
      .slice(0, limit)
      .map((family): VimCommandSuggestion => ({
        name: family,
        completion: `font ${family}`,
        description: "Set font family",
        usage: `font ${family}`,
        category: "format",
      }));
  }

  const values = commandArguments[commandName];
  if (values && /\s/u.test(input.replace(/^:/, ""))) {
    return values
      .filter((value) => value.startsWith(argument))
      .slice(0, limit)
      .map((value): VimCommandSuggestion => ({
        name: value,
        completion: `${commandName} ${value}`,
        description: `Set ${commandName.replace(/-/g, " ")}`,
        usage: `${commandName} ${value}`,
        category: "format",
      }));
  }

  const matches = vimCommandRegistry.filter((command) => {
    if (!commandName) {
      return true;
    }
    return [command.name, ...(command.aliases ?? [])].some((name) =>
      name.startsWith(commandName)
    );
  });

  return matches
    .sort((left, right) => {
      const leftMatch = [left.name, ...(left.aliases ?? [])].find((name) => name.startsWith(commandName)) ?? left.name;
      const rightMatch = [right.name, ...(right.aliases ?? [])].find((name) => name.startsWith(commandName)) ?? right.name;
      const leftScore = leftMatch === commandName ? 0 : leftMatch.length;
      const rightScore = rightMatch === commandName ? 0 : rightMatch.length;
      return leftScore - rightScore || left.name.localeCompare(right.name);
    })
    .slice(0, limit)
    .map((command): VimCommandSuggestion => ({
      ...command,
      completion: command.name,
    }));
};
