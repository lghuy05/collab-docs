"use client";

import type { Editor } from "@tiptap/react";
import { useOthers, useStatus, useSyncStatus } from "@liveblocks/react";
import { useCallback, useEffect, useState } from "react";
import { useEditorStore } from "@/store/use-editor-store";
import { getVimCommandSuggestions } from "@/extensions/vim/command-registry";
import { vimEnginePluginKey } from "@/extensions/vim/engine";

type VimStatus = {
  command: string;
  commandPaletteQuery: string;
  isSearchInput: boolean;
  searchMatchCount: number;
  searchMatchIndex: number | null;
  commandSelectionIndex: number | null;
  enabled: boolean;
  mode: "normal" | "insert" | "visual";
  recordingMacro: string | null;
  words: number;
};

const readEditorStatus = (editor: Editor): VimStatus => {
  const vim = editor.storage.vimMode;
  const engine = vimEnginePluginKey.getState(editor.state);
  const text = editor.getText().trim();

  return {
    command: vim.commandActive ? `:${vim.commandBuffer}` : "",
    commandPaletteQuery: vim.commandPaletteQuery,
    isSearchInput: vim.commandBuffer.startsWith("/") || vim.commandBuffer.startsWith("?"),
    searchMatchCount: vim.searchMatchCount,
    searchMatchIndex: vim.searchMatchIndex,
    commandSelectionIndex: vim.commandSelectionIndex,
    enabled: vim.enabled,
    mode: vim.mode,
    recordingMacro: engine?.recordingMacro ?? null,
    words: text ? text.split(/\s+/u).length : 0,
  };
};

export const VimStatusBar = () => {
  const editor = useEditorStore((state) => state.editor);

  if (!editor) {
    return null;
  }

  return <VimStatusBarContent editor={editor} />;
};

const VimStatusBarContent = ({ editor }: { editor: Editor }) => {
  const connectionStatus = useStatus();
  const syncStatus = useSyncStatus({ smooth: true });
  const collaboratorCount = useOthers().length + 1;
  const [editorStatus, setEditorStatus] = useState(() => readEditorStatus(editor));

  const refresh = useCallback(() => {
    setEditorStatus(readEditorStatus(editor));
  }, [editor]);

  useEffect(() => {
    refresh();
    editor.on("transaction", refresh);

    // Ex-command input updates DOM attributes without creating a transaction.
    const observer = new MutationObserver(refresh);
    observer.observe(editor.view.dom, {
      attributeFilter: ["data-vim-command", "data-vim-command-active", "data-vim-command-index", "data-vim-mode"],
      attributes: true,
    });

    return () => {
      editor.off("transaction", refresh);
      observer.disconnect();
    };
  }, [editor, refresh]);

  if (!editorStatus.enabled) {
    return null;
  }

  const saveLabel = connectionStatus === "disconnected"
    ? "Offline"
    : connectionStatus === "connecting" || connectionStatus === "reconnecting"
      ? "Connecting…"
      : syncStatus === "synchronizing"
        ? "Saving…"
        : "Saved";
  const suggestions = editorStatus.command
    ? getVimCommandSuggestions(editorStatus.commandPaletteQuery)
    : [];

  return (
    <>
      {editorStatus.command && !editorStatus.isSearchInput && (
        <div
          aria-label="Vim command palette"
          className="fixed bottom-6 left-0 z-50 w-full max-w-xl border border-slate-700 bg-[#1f2329] font-mono text-xs text-slate-100 shadow-lg print:hidden"
        >
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-slate-400">No matching command</div>
          ) : suggestions.map((command, index) => (
            <div
              key={command.name}
              className={`flex items-center gap-3 px-3 py-1.5 ${index === editorStatus.commandSelectionIndex ? "bg-slate-700/70" : ""}`}
            >
              <span className="min-w-28 text-emerald-300">:{command.completion}</span>
              <span className="min-w-0 flex-1 truncate text-slate-300">{command.description}</span>
              {command.usage && <span className="hidden text-slate-500 sm:inline">{command.usage}</span>}
            </div>
          ))}
        </div>
      )}
      <div
        aria-label="Vim status"
        className="fixed inset-x-0 bottom-0 z-40 flex h-6 items-center bg-[#1f2329] font-mono text-[11px] leading-none text-slate-200 shadow-[0_-1px_0_rgba(0,0,0,0.2)] print:hidden"
      >
        <span className="flex h-full shrink-0 items-center bg-green-600 px-2 font-bold text-white">
          -- {editorStatus.mode.toUpperCase()} --
        </span>
        <span className="min-w-0 flex-1 truncate px-2 text-slate-100">
          {editorStatus.command || (editorStatus.recordingMacro ? `recording @${editorStatus.recordingMacro}` : "--")}
        </span>
        {editorStatus.searchMatchIndex != null && (
          <span className="shrink-0 text-slate-400">
            {editorStatus.searchMatchIndex + 1}/{editorStatus.searchMatchCount}
          </span>
        )}
        <div className="flex h-full shrink-0 items-center gap-3 px-2 text-slate-300 sm:gap-4">
          <span>{editorStatus.words} {editorStatus.words === 1 ? "word" : "words"}</span>
          <span className="hidden sm:inline">{saveLabel}</span>
          <span title={`${collaboratorCount} active collaborator${collaboratorCount === 1 ? "" : "s"}`}>
            {collaboratorCount} online
          </span>
        </div>
      </div>
    </>
  );
};
