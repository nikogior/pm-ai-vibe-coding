# Kanban Studio

## Run

```bash
npm install
npm run dev
```

## Static export

```bash
npm run build
```

This creates `out/`, which the Docker image includes for FastAPI to serve at `/`.

The demo sign-in uses `user` / `password`. Its browser-local session is for the MVP experience only and is not server-side security.

## Tests

```bash
npm run test:unit
npm run test:e2e
```
