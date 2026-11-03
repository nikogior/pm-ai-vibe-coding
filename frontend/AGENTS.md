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
  - AuthGate.tsx: client-side demo sign-in gate, local session restoration, and logout.
  - KanbanBoard.tsx: main board component with drag-and-drop orchestration, card creation, card deletion, and column renaming.
  - KanbanColumn.tsx: UI for each Kanban column, plus add-card and rename actions.
  - KanbanCard.tsx: card display for a single task inside a column.
  - KanbanCardPreview.tsx: drag overlay preview used during drag interactions.
  - NewCardForm.tsx: inline form for adding a card to a column.

- lib/
  - kanban.ts: board model, seed data, drag reorder logic, and helper functions such as createId and moveCard.

- test/
  - setup.ts: Vitest/JSDOM test bootstrap.

## Current behavior

The app is a static and in-memory demo board. It includes:
- a demo sign-in gate with fixed user / password credentials
- browser-local session restoration and logout
- five default columns
- drag-and-drop card movement between columns
- inline column renaming
- adding cards to a column
- deleting cards
- seeded sample project work items for a board

This is a client-only implementation served as a static export. The demo sign-in gate stores its session in localStorage; it is not server-side authentication. There is no persistent backend integration or AI integration yet.

## Important implementation notes

- The app uses Next.js 16 with React 19.
- Drag-and-drop is implemented with @dnd-kit.
- State is stored in React useState; there is no API layer yet.
- All board state is defined in lib/kanban.ts and is a good foundation for later backend persistence.
- Styling is global CSS-driven and uses design tokens for the color system defined in the project requirements.

## Testing setup

- Vitest is used for unit tests.
- Testing Library is used for component tests.
- Playwright is available for end-to-end flows when the app is more complete.

## Key files to read first

1. src/app/page.tsx
2. src/components/KanbanBoard.tsx
3. src/lib/kanban.ts
4. src/components/KanbanColumn.tsx
5. src/components/KanbanCard.tsx

## Working principles for future changes

- Keep the code simple and close to the current demo structure.
- Reuse the board model in lib/kanban.ts when introducing persistence or AI updates.
- Maintain a clear separation between board logic, UI components, and tests.
- Prefer incremental changes that match the MVP roadmap rather than broad refactors.
