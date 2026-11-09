# Backend AGENTS guide

This directory contains the FastAPI service for the PM AI Vibe Coding app.

## Current state

The backend currently provides:
- the exported Next.js frontend at `/`
- `/health` for health checks
- `/api/hello` as a sample API endpoint
- `/api/auth/login`, `/api/auth/session`, and `/api/auth/logout` for persistent cookie sessions
- authenticated `/api/board` read and replace endpoints
- authenticated `/api/ai/connectivity` for a basic OpenRouter model request
- authenticated `/api/ai/chat` for board-aware chat and validated board updates

SQLite is initialized at first startup, seeds the configured MVP user and sample board, and stores the database under `/data` in Docker. A named Docker volume persists it across container replacement. Passwords are stored as PBKDF2 hashes; session tokens are opaque and only their SHA-256 digests are stored.

The frontend is exported to `frontend/out` during the Docker image build. FastAPI serves that directory as static files after registering its API routes.

## Key files

- app/main.py: FastAPI app, API routes, and static frontend mount
- app/database.py: SQLite schema, initial user/board seeding, password hashing, and session helpers
- app/board.py: board validation and mapping between API models and SQLite
- app/ai.py: OpenRouter configuration, request handling, and response validation
- tests/test_main.py: coverage for frontend, API, authentication, and board updates
- tests/test_ai.py: coverage for OpenRouter request, response schemas, and error handling

## Working principles

- Keep the backend simple and minimal.
- Use FastAPI and SQLite as the foundation for later project features.
- Add tests before broadening the API surface.
