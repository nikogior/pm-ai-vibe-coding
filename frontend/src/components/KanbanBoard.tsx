"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  pointerWithin,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanColumn } from "@/components/KanbanColumn";
import { KanbanCardPreview } from "@/components/KanbanCardPreview";
import { createId, moveCard, type BoardData } from "@/lib/kanban";

const kanbanCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const nonActiveCollisions = pointerCollisions.filter(
    (collision) => collision.id !== args.active.id
  );
  const cardCollisions = nonActiveCollisions.filter((collision) =>
    args.droppableContainers.some(
      (container) =>
        container.id === collision.id && container.data.current?.sortable
    )
  );

  if (cardCollisions.length > 0) {
    return cardCollisions;
  }
  if (nonActiveCollisions.length > 0) {
    return nonActiveCollisions;
  }
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

export const KanbanBoard = ({
  onLogout,
  logoutError,
}: {
  onLogout?: () => void;
  logoutError?: string;
}) => {
  const [board, setBoard] = useState<BoardData | null>(null);
  const [activeCardId, setActiveCardId] = useState<string | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isChatBusy, setIsChatBusy] = useState(false);
  const boardRef = useRef<BoardData | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());
  const renameSaveTimeout = useRef<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    })
  );

  useEffect(() => {
    let active = true;
    fetch("/api/board")
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Unable to load the board.");
        }
        return (await response.json()) as BoardData;
      })
      .then((loadedBoard) => {
        if (active) {
          boardRef.current = loadedBoard;
          setBoard(loadedBoard);
        }
      })
      .catch(() => {
        if (active) {
          setLoadError("Unable to load your board. Please refresh to try again.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const cardsById = useMemo(() => board?.cards ?? {}, [board?.cards]);

  const persistBoard = (next: BoardData): Promise<void> => {
    const save = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        const response = await fetch("/api/board", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) {
          throw new Error("Board save request failed.");
        }
        const savedBoard = (await response.json()) as BoardData;
        if (boardRef.current === next) {
          boardRef.current = savedBoard;
          setBoard(savedBoard);
        }
        setSaveError("");
      });
    saveQueue.current = save.catch(() => {
      setSaveError("Your changes could not be saved. Please try again.");
    });
    return save;
  };

  const updateBoard = (
    update: (current: BoardData) => BoardData,
    debounce = false
  ) => {
    const current = boardRef.current;
    if (!current) {
      return;
    }

    const next = update(current);
    boardRef.current = next;
    setBoard(next);

    const persist = () => {
      void persistBoard(next).catch(() => undefined);
    };

    if (debounce) {
      if (renameSaveTimeout.current !== null) {
        window.clearTimeout(renameSaveTimeout.current);
      }
      renameSaveTimeout.current = window.setTimeout(() => {
        renameSaveTimeout.current = null;
        persist();
      }, 250);
    } else {
      if (renameSaveTimeout.current !== null) {
        window.clearTimeout(renameSaveTimeout.current);
        renameSaveTimeout.current = null;
      }
      persist();
    }
  };

  const prepareBoardForChat = async () => {
    if (renameSaveTimeout.current !== null) {
      window.clearTimeout(renameSaveTimeout.current);
      renameSaveTimeout.current = null;
    }
    const current = boardRef.current;
    if (!current) {
      throw new Error("Your board is still loading. Please try again.");
    }
    await persistBoard(current);
  };

  const applyAIBoard = (updatedBoard: BoardData) => {
    boardRef.current = updatedBoard;
    setBoard(updatedBoard);
    setSaveError("");
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveCardId(event.active.id as string);
    setOverColumnId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id.toString();
    const currentBoard = boardRef.current;
    const overColumn = currentBoard?.columns.find(
      (column) =>
        column.id === overId || column.cardIds.includes(String(overId))
    );
    setOverColumnId(overColumn?.id ?? null);
  };

  const handleDragCancel = () => {
    setActiveCardId(null);
    setOverColumnId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCardId(null);
    setOverColumnId(null);

    if (!over || active.id === over.id) {
      return;
    }

    updateBoard((current) => ({
      ...current,
      columns: moveCard(current.columns, active.id as string, over.id as string),
    }));
  };

  const handleRenameColumn = (columnId: string, title: string) => {
    updateBoard((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === columnId ? { ...column, title } : column
      ),
    }), true);
  };

  const handleAddCard = (columnId: string, title: string, details: string) => {
    const id = createId("card");
    updateBoard((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [id]: { id, title, details: details || "No details yet." },
      },
      columns: current.columns.map((column) =>
        column.id === columnId
          ? { ...column, cardIds: [...column.cardIds, id] }
          : column
      ),
    }));
  };

  const handleDeleteCard = (columnId: string, cardId: string) => {
    updateBoard((current) => ({
      ...current,
      cards: Object.fromEntries(
        Object.entries(current.cards).filter(([id]) => id !== cardId)
      ),
      columns: current.columns.map((column) =>
        column.id === columnId
          ? {
              ...column,
              cardIds: column.cardIds.filter((id) => id !== cardId),
            }
          : column
      ),
    }));
  };

  const handleEditCard = (cardId: string, title: string, details: string) => {
    updateBoard((current) => ({
      ...current,
      cards: {
        ...current.cards,
        [cardId]: { ...current.cards[cardId], title, details },
      },
    }));
  };

  const activeCard = activeCardId ? cardsById[activeCardId] : null;

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-red-700" role="alert">
          {loadError}
        </p>
      </main>
    );
  }

  if (!board) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-sm text-[var(--gray-text)]">Loading your board...</p>
      </main>
    );
  }

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute left-0 top-0 h-[420px] w-[420px] -translate-x-1/3 -translate-y-1/3 rounded-full bg-[radial-gradient(circle,_rgba(32,157,215,0.25)_0%,_rgba(32,157,215,0.05)_55%,_transparent_70%)]" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-[520px] w-[520px] translate-x-1/4 translate-y-1/4 rounded-full bg-[radial-gradient(circle,_rgba(117,57,145,0.18)_0%,_rgba(117,57,145,0.05)_55%,_transparent_75%)]" />

      <main className="relative mx-auto flex min-h-screen max-w-[1700px] flex-col gap-10 px-6 pb-16 pt-12">
        <header className="flex flex-col gap-6 rounded-[32px] border border-[var(--stroke)] bg-white/80 p-8 shadow-[var(--shadow)] backdrop-blur">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
                Single Board Kanban
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold text-[var(--navy-dark)]">
                Kanban Studio
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--gray-text)]">
                Keep momentum visible. Rename columns, edit cards, drag work
                between stages, and capture quick notes without getting buried
                in settings.
              </p>
            </div>
            <div className="flex flex-wrap items-start gap-3">
              <div className="rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
                  Focus
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--primary-blue)]">
                  One board. Five columns. Zero clutter.
                </p>
              </div>
              {onLogout ? (
                <div className="flex flex-col items-end gap-2">
                  {logoutError ? (
                    <p className="text-sm text-red-700" role="alert">
                      {logoutError}
                    </p>
                  ) : null}
                  <button
                    className="rounded-xl border border-[var(--stroke)] bg-white px-4 py-3 text-sm font-semibold text-[var(--navy-dark)] transition hover:border-[var(--primary-blue)]"
                    onClick={onLogout}
                    type="button"
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {board.columns.map((column) => (
              <div
                key={column.id}
                className="flex items-center gap-2 rounded-full border border-[var(--stroke)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
              >
                <span className="h-2 w-2 rounded-full bg-[var(--accent-yellow)]" />
                {column.title}
              </div>
            ))}
          </div>
        </header>

        <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <DndContext
            sensors={sensors}
            collisionDetection={kanbanCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="min-w-0">
              {saveError ? (
                <p className="mb-4 text-sm text-red-700" role="alert">
                  {saveError}
                </p>
              ) : null}
              <section
                aria-busy={isChatBusy}
                className="grid gap-6 lg:grid-cols-5"
                inert={isChatBusy}
              >
                {board.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cardIds.map((cardId) => board.cards[cardId])}
                    isDragTarget={overColumnId === column.id}
                    onRename={handleRenameColumn}
                    onAddCard={handleAddCard}
                    onEditCard={handleEditCard}
                    onDeleteCard={handleDeleteCard}
                  />
                ))}
              </section>
              <DragOverlay>
                {activeCard ? (
                  <div className="w-[260px]">
                    <KanbanCardPreview card={activeCard} />
                  </div>
                ) : null}
              </DragOverlay>
            </div>
          </DndContext>
          <ChatSidebar
            onPrepareChat={prepareBoardForChat}
            onBoardUpdate={applyAIBoard}
            onBusyChange={setIsChatBusy}
          />
        </div>
      </main>
    </div>
  );
};
