FROM node:22-alpine AS frontend-build

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DATABASE_PATH=/data/kanban.sqlite3

RUN python -m pip install --upgrade pip && python -m pip install uv

COPY backend /app/backend
COPY --from=frontend-build /app/frontend/out /app/frontend/out
WORKDIR /app/backend
RUN uv pip install --system --no-cache -e '.[dev]'

RUN mkdir -p /data
VOLUME ["/data"]

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
