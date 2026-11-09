# Frontend AGENTS guide

## Purpose

This directory contains the current Next.js frontend MVP for the project management Kanban app. Next.js builds a static export in `out/`, which FastAPI serves from the application root in Docker.

## App structure

- app/
  - app/page.tsx: root page entry. It renders the Kanban board component.
  - app/layout.tsx: application shell and global metadata.
  - app/globals.css: global theme tokens and shared styling.
- next.config.ts: configures Next.js static export.

- components/
  - AuthGate.tsx: sign-in form connected to backend session validation, login, and logout endpoints.
  - KanbanBoard.tsx: main board component with drag-and-drop orchestration, card creation, card deletion, and column renaming.
  - KanbanColumn.tsx: UI for each Kanban column, plus add-card and rename actions.
  - KanbanCard.tsx: card display for a single task inside a column.
  - KanbanCardPreview.tsx: drag overlay preview used during drag interactions.
  - ChatSidebar.tsx: AI conversation UI and handling validated backend replies and board updates.
  - NewCardForm.tsx: inline form for adding a card to a column.

- lib/
  - kanban.ts: board model, seed data, drag reorder logic, and helper functions such as createId and moveCard.

- test/
  - setup.ts: Vitest/JSDOM test bootstrap.

## Current behavior

The app is a static frontend served by FastAPI. It includes:
- a demo sign-in gate with fixed user / password credentials
- persistent cookie-backed session restoration and logout through FastAPI
- loading the signed-in user's board from FastAPI
- saving card creation, editing, deletion, movement, and column renames to FastAPI
- five default columns
- drag-and-drop card movement between columns
- inline column renaming
- adding cards to a column
- deleting cards
- seeded sample project work items for a board
- an AI sidebar that sends conversation history and applies board updates returned by the backend

The frontend is served as a static export. Authentication, board state, and AI board updates are backed by FastAPI and SQLite.

## Important implementation notes

- The app uses Next.js 16 with React 19.
- Drag-and-drop is implemented with @dnd-kit.
- Board drops use pointer collision first, preferring card targets and otherwise the column; the hovered target column is highlighted, including when a card is under the pointer.
- KanbanBoard fetches the user's saved board on mount and persists supported mutations through `/api/board`.
- ChatSidebar sends conversation history to `/api/ai/chat`, displays replies and errors, and immediately applies returned board updates.
- Board editing is temporarily disabled while a chat request runs, and pending board edits are saved before the request.
- Board state is held in React state while displayed; SQLite is the durable source of truth.
- Existing card titles and details can be edited inline before saving to the backend.
- The board model and seed data are defined in lib/kanban.ts.
- Styling is global CSS-driven and uses design tokens for the color system defined in the project requirements.

## Testing setup

- Vitest is used for unit tests.
- Testing Library is used for component tests.
- Playwright is available for end-to-end flows when the app is more complete.

## Key files to read first

1. src/app/page.tsx
2. src/components/KanbanBoard.tsx
3. src/components/ChatSidebar.tsx
4. src/lib/kanban.ts
5. src/components/KanbanColumn.tsx
6. src/components/KanbanCard.tsx

## Working principles for future changes

- Keep the code simple and close to the current demo structure.
- Reuse the board model in lib/kanban.ts when introducing persistence or AI updates.
- Maintain a clear separation between board logic, UI components, and tests.
- Prefer incremental changes that match the MVP roadmap rather than broad refactors.
