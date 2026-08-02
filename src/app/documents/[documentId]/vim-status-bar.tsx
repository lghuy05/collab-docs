"use client";

import type { Editor } from "@tiptap/react";
import { useOthers, useStatus, useSyncStatus } from "@liveblocks/react";
import { useCallback, useEffect, useState } from "react";
import { useEditorStore } from "@/store/use-editor-store";

type VimStatus = {
  command: string;
  enabled: boolean;
  mode: "normal" | "insert" | "visual";
  words: number;
};

const readEditorStatus = (editor: Editor): VimStatus => {
  const vim = editor.storage.vimMode;
  const text = editor.getText().trim();

  return {
    command: vim.commandActive ? `:${vim.commandBuffer}` : "",
    enabled: vim.enabled,
    mode: vim.mode,
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
      attributeFilter: ["data-vim-command", "data-vim-command-active", "data-vim-mode"],
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

  return (
    <div
      aria-label="Vim status"
      className="fixed inset-x-0 bottom-0 z-40 flex h-6 items-center bg-[#1f2329] font-mono text-[11px] leading-none text-slate-200 shadow-[0_-1px_0_rgba(0,0,0,0.2)] print:hidden"
    >
      <span className="flex h-full shrink-0 items-center bg-green-600 px-2 font-bold text-white">
        -- {editorStatus.mode.toUpperCase()} --
      </span>
      <span className="min-w-0 flex-1 truncate px-2 text-slate-100">
        {editorStatus.command || "--"}
      </span>
      <div className="flex h-full shrink-0 items-center gap-3 px-2 text-slate-300 sm:gap-4">
        <span>{editorStatus.words} {editorStatus.words === 1 ? "word" : "words"}</span>
        <span className="hidden sm:inline">{saveLabel}</span>
        <span title={`${collaboratorCount} active collaborator${collaboratorCount === 1 ? "" : "s"}`}>
          {collaboratorCount} online
        </span>
      </div>
    </div>
  );
};
