# SQLite database proposal

The approved MVP persistence layer uses SQLite, created on first app startup.

## Tables and relationships

The schema in [database-schema.json](./database-schema.json) defines:

- `users`: unique usernames and password hashes; the MVP seeds the fixed `user` account from the configured demo credential.
- `boards`: one board per user, enforced by a unique `user_id`.
- `columns`: ordered columns belonging to a board. Titles are editable; default columns are created with the initial board.
- `cards`: ordered cards with title/details, linked to a column on their own board.
- `auth_sessions`: persistent sign-in sessions tied to a user.

Foreign keys cascade when a user or board is removed. Position columns represent board order. SQLite foreign-key enforcement must be enabled for each connection.

## Persistent sign-in behavior

Before Part 6, the frontend stored the literal username in browser `localStorage`; that was not an authoritative server session and was not stored in SQLite.

The backend-backed authentication now uses this persistent session design:

1. Validate the demo credentials on the FastAPI backend. Store the account’s password hash, not its plaintext password.
2. Generate a random opaque session token and store only its digest in `auth_sessions`.
3. Send the token to the browser in an `HttpOnly`, `SameSite=Lax` cookie with a 30-day expiry, so the browser retains sign-in across reloads, browser restarts, and backend/container restarts.
4. On requests, validate the token digest and expiry against SQLite. Logout deletes the session row and clears the cookie.
5. Expired sessions are rejected and may be removed during normal session handling.

This is a local MVP session design. The browser sign-in screen uses the backend session endpoints; board state is still local in the frontend until Part 7 connects it to the API.

## Backend API in Part 6

- `POST /api/auth/login` validates the demo account and sets the session cookie.
- `GET /api/auth/session` reports whether the cookie is valid.
- `POST /api/auth/logout` revokes the session and clears the cookie.
- `GET /api/board` returns the authenticated user's board.
- `PUT /api/board` atomically replaces the authenticated user's board content. Column IDs and order remain fixed, while column titles and card contents/order can change.

## Assumptions and future changes

- IDs are application-generated text values.
- Timestamps are UTC ISO-8601 text.
- The database file is `/data/kanban.sqlite3` inside the container and must be stored in a persistent Docker volume named `pm-ai-vibe-coding-data` so board data and sign-in sessions survive container replacement.
- One user owns one board for the MVP; a later migration can remove the unique constraint if users need multiple boards.
- Schema changes after initial release should use numbered migrations. The initial database setup can create these tables directly.
- The hardcoded MVP account is seeded only when absent; future account management can use the same users table.

## Approval requested

The schema and 30-day persistent, database-backed sign-in design were approved before Part 6 implementation.
