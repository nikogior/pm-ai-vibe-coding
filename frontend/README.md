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

The demo sign-in uses `user` / `password`. FastAPI validates the credentials and issues a persistent HttpOnly cookie backed by the SQLite session table.

## Tests

```bash
npm run test:unit
npm run test:e2e
```
