"use client";

import { useState, type FormEvent } from "react";
import type { BoardData } from "@/lib/kanban";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

type ChatResponse =
  | { type: "reply"; message: string }
  | { type: "board_update"; message: string; board: BoardData };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isBoardData = (value: unknown): value is BoardData => {
  if (!isRecord(value) || !Array.isArray(value.columns) || !isRecord(value.cards)) {
    return false;
  }
  return (
    value.columns.every(
      (column) =>
        isRecord(column) &&
        typeof column.id === "string" &&
        typeof column.title === "string" &&
        Array.isArray(column.cardIds) &&
        column.cardIds.every((cardId) => typeof cardId === "string")
    ) &&
    Object.entries(value.cards).every(
      ([id, card]) =>
        isRecord(card) &&
        card.id === id &&
        typeof card.title === "string" &&
        typeof card.details === "string"
    )
  );
};

const parseChatResponse = (value: unknown): ChatResponse => {
  if (!isRecord(value) || typeof value.message !== "string") {
    throw new Error("The AI returned an invalid response.");
  }
  if (value.type === "reply") {
    return { type: "reply", message: value.message };
  }
  if (value.type === "board_update" && isBoardData(value.board)) {
    return { type: "board_update", message: value.message, board: value.board };
  }
  throw new Error("The AI returned an invalid response.");
};

export const ChatSidebar = ({
  onPrepareChat,
  onBoardUpdate,
  onBusyChange,
}: {
  onPrepareChat: () => Promise<void>;
  onBoardUpdate: (board: BoardData) => void;
  onBusyChange: (busy: boolean) => void;
}) => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isSending) {
      return;
    }

    setIsSending(true);
    setError("");
    onBusyChange(true);
    try {
      await onPrepareChat();
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history: messages.slice(-40),
        }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        const detail =
          isRecord(body) && typeof body.detail === "string"
            ? body.detail
            : "Unable to contact the AI. Please try again.";
        throw new Error(detail);
      }

      const result = parseChatResponse(body);
      if (result.type === "board_update") {
        onBoardUpdate(result.board);
      }
      setMessages((current) => [
        ...current,
        { role: "user", content: message },
        { role: "assistant", content: result.message },
      ]);
      setDraft("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to contact the AI. Please try again."
      );
    } finally {
      onBusyChange(false);
      setIsSending(false);
    }
  };

  return (
    <aside
      aria-label="AI assistant"
      className="flex min-h-[420px] max-h-[calc(100vh-3rem)] flex-col overflow-hidden rounded-[28px] border border-[var(--stroke)] bg-white/90 shadow-[var(--shadow)] 2xl:sticky 2xl:top-6"
    >
      <header className="border-b border-[var(--stroke)] px-5 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
          Board assistant
        </p>
        <h2 className="mt-2 font-display text-xl font-semibold text-[var(--navy-dark)]">
          AI chat
        </h2>
        <p className="mt-2 text-sm leading-5 text-[var(--gray-text)]">
          Ask about your board or request card changes.
        </p>
      </header>

      <ol
        aria-label="Conversation"
        aria-live="polite"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {messages.length === 0 ? (
          <li className="my-auto px-2 text-center text-sm leading-6 text-[var(--gray-text)]">
            Ask a question or describe a board change.
          </li>
        ) : (
          messages.map((message, index) => (
            <li
              key={`${index}-${message.role}`}
              className={`max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-5 ${
                message.role === "user"
                  ? "self-end bg-[var(--navy-dark)] text-white"
                  : "self-start bg-[var(--surface)] text-[var(--navy-dark)]"
              }`}
            >
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
                {message.role === "user" ? "You" : "Assistant"}
              </p>
              <p className="whitespace-pre-wrap">{message.content}</p>
            </li>
          ))
        )}
        {isSending ? (
          <li className="self-start px-3 py-2 text-sm text-[var(--gray-text)]">
            Thinking...
          </li>
        ) : null}
      </ol>

      <form
        className="flex flex-col gap-3 border-t border-[var(--stroke)] p-4"
        onSubmit={handleSubmit}
      >
        <label className="sr-only" htmlFor="ai-message">
          Message the AI
        </label>
        <textarea
          className="min-h-24 resize-y rounded-xl border border-[var(--stroke)] bg-white px-3 py-3 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          disabled={isSending}
          id="ai-message"
          maxLength={4000}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask a question or request a change..."
          value={draft}
        />
        {error ? (
          <p className="text-sm text-red-700" role="alert">
            {error}
          </p>
        ) : null}
        <button
          className="rounded-xl bg-[var(--secondary-purple)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSending || draft.trim().length === 0}
          type="submit"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};
