# Scripts AGENTS guide

This folder contains the startup and shutdown scripts for running the app locally in Docker.

## Script files

- start-linux.sh
- start-mac.sh
- start-windows.ps1
- stop-linux.sh
- stop-mac.sh
- stop-windows.ps1

## Purpose

The scripts build the Docker image and run the FastAPI service locally, exposing the app on port 8000.

## Notes

- The scripts rely on Docker being installed and available on PATH.
- They read environment variables from the project root .env file at runtime.
- They mount the persistent `pm-ai-vibe-coding-data` Docker volume at `/data` for the SQLite database.
- These scripts are intentionally simple and should stay easy to maintain.
