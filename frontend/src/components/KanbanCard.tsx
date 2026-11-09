import { useState, type FormEvent, type SyntheticEvent } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import clsx from "clsx";
import type { Card } from "@/lib/kanban";

type KanbanCardProps = {
  card: Card;
  onDelete: (cardId: string) => void;
  onEdit: (cardId: string, title: string, details: string) => void;
};

export const KanbanCard = ({ card, onDelete, onEdit }: KanbanCardProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [details, setDetails] = useState(card.details);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onEdit(card.id, title.trim(), details.trim());
    setIsEditing(false);
  };

  const stopDrag = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={clsx(
        "rounded-2xl border border-transparent bg-white px-4 py-4 shadow-[0_12px_24px_rgba(3,33,71,0.08)]",
        "transition-all duration-150",
        isDragging && "opacity-60 shadow-[0_18px_32px_rgba(3,33,71,0.16)]"
      )}
      {...attributes}
      {...listeners}
      data-testid={`card-${card.id}`}
    >
      {isEditing ? (
        <form
          className="flex flex-col gap-3"
          onSubmit={handleSubmit}
          onPointerDown={stopDrag}
          onKeyDown={stopDrag}
        >
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--gray-text)]">
            Title
            <input
              aria-label="Edit card title"
              className="rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)]"
              onChange={(event) => setTitle(event.target.value)}
              required
              value={title}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--gray-text)]">
            Details
            <textarea
              aria-label="Edit card details"
              className="min-h-20 rounded-lg border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)]"
              onChange={(event) => setDetails(event.target.value)}
              value={details}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              className="rounded-lg border border-[var(--stroke)] px-3 py-2 text-xs font-semibold text-[var(--navy-dark)]"
              onClick={() => {
                setTitle(card.title);
                setDetails(card.details);
                setIsEditing(false);
              }}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-[var(--secondary-purple)] px-3 py-2 text-xs font-semibold text-white"
              type="submit"
            >
              Save changes
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-display text-base font-semibold text-[var(--navy-dark)]">
              {card.title}
            </h4>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--gray-text)]">
              {card.details}
            </p>
          </div>
          <div
            className="flex shrink-0 items-center gap-1"
            onPointerDown={stopDrag}
            onKeyDown={stopDrag}
          >
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Edit ${card.title}`}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDelete(card.id)}
              className="rounded-full border border-transparent px-2 py-1 text-xs font-semibold text-[var(--gray-text)] transition hover:border-[var(--stroke)] hover:text-[var(--navy-dark)]"
              aria-label={`Delete ${card.title}`}
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </article>
  );
};
