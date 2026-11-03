# Backend AGENTS guide

This directory contains the FastAPI service for the PM AI Vibe Coding app.

## Current state

The backend currently provides:
- the exported Next.js frontend at `/`
- `/health` for health checks
- `/api/hello` as a sample API endpoint

The frontend is exported to `frontend/out` during the Docker image build. FastAPI serves that directory as static files after registering its API routes.

## Key files

- app/main.py: FastAPI app, API routes, and static frontend mount
- tests/test_main.py: coverage for frontend serving and API responses

## Working principles

- Keep the backend simple and minimal.
- Use FastAPI and SQLite as the foundation for later project features.
- Add tests before broadening the API surface.
