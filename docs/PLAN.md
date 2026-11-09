# Project plan and execution checklist

## Testing approach

- Prioritize tests that protect user-visible behavior and critical logic.
- Aim for approximately 80% test coverage for changed code when that is practical and useful.
- Do not add low-value tests solely to reach a coverage percentage; document meaningful gaps instead.

## Part 1: Planning and repo baselining

Purpose: confirm the current state of the app, capture the implementation steps in a clear order, and document the frontend code so the next agent can work safely in the right places.

Checklist:
- [x] Review the existing frontend MVP, backend structure, and repo conventions.
- [x] Document the current project architecture and the feature gaps between the demo and the MVP requirements.
- [x] Write a detailed implementation roadmap with test and acceptance criteria for each phase.
- [x] Create a frontend-specific AGENTS.md that explains the current app structure and key files.
- [x] Present the plan to the user and wait for approval before moving to scaffolding.

Validation:
- Review the plan text for clarity and completeness.
- Verify the frontend AGENTS.md matches the actual code in frontend/src.
- Confirm the sequence of work is logically ordered and complete.

Success criteria:
- The plan is specific enough to execute phase by phase without guesswork.
- The frontend AGENTS.md describes the current codebase accurately.
- The user approves the plan before continuing.

## Part 2: Scaffolding the app runtime

Purpose: establish the Dockerized local environment, initialize the FastAPI backend, and add the scripts that allow the project to run locally.

Checklist:
- [x] Add Docker configuration for the app container.
- [x] Create the backend package structure under backend/ using FastAPI.
- [x] Add a startup script for the local environment.
- [x] Add a shutdown script for the local environment.
- [x] Confirm a simple hello-world endpoint is served by the backend.
- [x] Confirm the container is able to serve a static response and answer a basic API request.

Validation:
- Run the start script and verify the app responds locally.
- Invoke the backend API from a browser or curl and confirm a known response.
- Verify the app boots cleanly without requiring manual code changes.

Success criteria:
- The project can be started locally with the provided scripts.
- A backend endpoint returns a valid JSON response.
- A basic page or static route responds successfully.

## Part 3: Frontend integration and static serving

Purpose: adapt the demo frontend to be served by the application and make it available at /.

Checklist:
- [x] Connect the Next.js frontend build output to the FastAPI app.
- [x] Serve the static frontend from the backend root path.
- [x] Ensure the Kanban demo renders at / and loads without frontend-only assumptions.
- [x] Fix any build or runtime issues caused by the app being served in Docker.
- [x] Add unit tests for the core board logic and page rendering.
- [x] Add integration coverage for the homepage loading.

Validation:
- Run the frontend build and ensure it succeeds.
- Run the relevant unit/integration tests.
- Start the app and confirm the homepage renders the Kanban board.

Success criteria:
- The application loads at / with the existing demo board visible after sign-in.
- The frontend build is production-safe in the deployed setup.
- Tests cover the board state, UI rendering, and homepage integration.

## Part 4: Fake sign-in flow

Purpose: add the MVP login experience before the board is visible.

Checklist:
- [x] Add a login screen gated behind the app root route.
- [x] Accept the dummy credentials user / password.
- [x] Show the Kanban board only after successful authentication.
- [x] Add a logout flow that returns the user to the login screen.
- [x] Persist the session in a minimal way suitable for the local MVP.
- [x] Add focused tests for valid login, invalid login, session restoration, and logout behavior.

Validation:
- Run focused unit and browser tests for sign-in, session restoration, and logout.
- Verify flow using the production Docker app locally.
- Confirm the board is hidden before login and visible after login.

Success criteria:
- Users must enter the MVP credentials before the board is shown.
- A sign-in session survives reloads in the same browser and is covered by focused tests.
- Logout removes the local session and returns the user to sign-in.
- High-value auth behavior is covered, aiming for approximately 80% coverage when sensible without adding tests just to meet a percentage.

## Part 5: Database schema and design review

Purpose: define the app’s persistence model before backend implementation.

Checklist:
- [x] Define the board, cards, columns, and user data model.
- [x] Design the schema to support multiple users and one board per user in the MVP.
- [x] Include persistent auth sessions so sign-in can survive browser and container restarts.
- [x] Save the proposed schema as a JSON document in docs/.
- [x] Document assumptions for future extension and migrations.
- [x] Present the database design to the user and receive approval.

Validation:
- [x] Check the JSON schema against the MVP requirements.
- [x] Confirm keys and relations cover board state and user ownership.
- [x] Ensure the schema is simple enough for SQLite without overengineering.
- [x] Confirm the proposed persistent sign-in behavior with the user.

Success criteria:
- The schema is agreed, documented, and ready for backend implementation.
- Sign-in and board state are designed to survive app/container restarts using SQLite on a persistent Docker volume.
- The user approves the chosen persistence approach.

## Part 6: Backend API and persistence

Purpose: implement the API layer to read and update board state for a user and create the database if it is missing.

Checklist:
- [x] Create the database if it does not exist.
- [x] Define the approved SQLite tables and initialization logic.
- [x] Add persistent login, session validation, and logout API routes backed by hashed opaque tokens.
- [x] Add an authenticated API route for loading a user's board.
- [x] Add an authenticated board update route supporting card create/update/move/delete and column renaming.
- [x] Connect the sign-in screen to the persistent backend session.
- [x] Store the SQLite file on a named Docker volume that survives container restarts.
- [x] Write focused backend tests for schema initialization, auth, board persistence, and invalid board updates.

Validation:
- [x] Run the backend test suite.
- [x] Test board mutations and auth session persistence with SQLite.
- [x] Verify the database is created automatically on first run.
- [x] Verify sign-in and board data persist through a production container restart.

Success criteria:
- The backend can read and persist the user's fixed-column Kanban board.
- Sign-in is persisted as a 30-day HttpOnly cookie session whose token digest is stored in SQLite.
- The app stores the database in a persistent Docker volume so data survives container restart/replacement.
- Focused backend and UI tests pass reliably.

## Part 7: Frontend + backend integration

Purpose: replace the demo-only in-memory board with data from the backend.

Checklist:
- [x] Update the frontend to fetch board data from the backend.
- [x] Submit supported card creation, deletion, movement, and column renames to the API.
- [x] Add a frontend UI for editing existing card titles/details and persist those edits.
- [x] Handle loading and error states gracefully.
- [x] Apply the board returned by successful API saves when no newer local change exists.
- [x] Add unit and browser tests for board loading, card edits, populated/empty-column drops, target highlighting, and same-column reordering.

Design decisions:
- Prefer pointer-based collision detection so a column under the pointer is a valid target even when it is empty; prefer card targets when the pointer is over a card, and retain closest-corners as a fallback when the pointer is not over a droppable.
- Highlight the destination column while dragging over either the column itself or one of its cards, and clear the highlight on drop or cancellation.

Validation:
- [x] Reproduce the empty-column/highlight failure with the previous closest-corners-only detection, then verify the pointer-prioritized fix.
- [x] Run frontend unit tests (10), browser tests (7), lint, and production build; all passed.
- [x] Run backend tests (11 passed; one existing Starlette/httpx deprecation warning).
- [x] Verify populated-column drops/highlighting, empty-column drops/highlighting, and same-column reordering in Chromium.
- [x] Verify card creation, editing, movement, and column renaming persist after reload against the Docker API.
- [x] Verify board changes remain after restarting a container with the same SQLite volume.
- [x] Verify the newly tested empty-column drop is saved by the Docker API and remains after page reload.
- [x] Confirm the frontend reflects API state changes correctly.

Success criteria:
- [x] The board is no longer static or local-only.
- [x] Supported board changes persist for the signed-in user across reloads and container restarts.
- [x] Current UI/API persistence behavior, including existing card edits, is covered by tests.
- [x] Existing card title/details can be edited from the UI and saved.

## Part 8: AI connectivity

Purpose: establish OpenRouter connectivity and confirm the backend can call the configured model.

Checklist:
- [x] Add the OpenRouter configuration and environment handling.
- [x] Test a basic AI request such as 2 + 2.
- [x] Validate required environment variables and error handling.
- [x] Confirm the backend can respond with the model output in a stable way.

Validation:
- [x] Execute a simple AI connectivity test in the backend; the configured model returned `4`.
- [x] Validate the stable response format and missing-key, upstream-status, network, and malformed-response handling.
- [x] Confirm the API key is read only from `OPENROUTER_API_KEY` and is not included in image build inputs or error responses.
- [x] Run backend tests (21 passed) and build and test the production Docker image.

Success criteria:
- [x] The model is reachable and returns a valid response.
- [x] The app can integrate a real AI call as a backend service.

## Part 9: Structured AI board operations

Purpose: send the board state plus user intent to the model and process structured output.

Checklist:
- [ ] Bundle the current Kanban JSON and conversation history with each AI request.
- [ ] Add a request schema for the model response.
- [ ] Allow the AI to return either a conversational reply or a board update.
- [ ] Validate the response before applying changes.
- [ ] Write tests covering normal AI chat responses and board mutation responses.

Validation:
- Run backend tests for the AI service.
- Verify both text-only and structured-update flows.
- Confirm dangerous or invalid AI output is rejected safely.

Success criteria:
- The AI can answer user questions using the board as context.
- Structured responses can modify cards or board state only when valid.
- The flow is stable and test-covered.

## Part 10: Sidebar chat UI and automatic refresh

Purpose: deliver the full MVP experience with an AI chat panel that can update the board.

Checklist:
- [ ] Add the sidebar chat widget to the frontend.
- [ ] Connect the chat UI to the backend AI endpoint.
- [ ] Render AI replies and conversation history.
- [ ] Accept structured AI updates to the board.
- [ ] Refresh the UI automatically when the board changes due to AI actions.
- [ ] Add end-to-end coverage for chat-driven card updates.

Validation:
- Run the browser-based UI tests.
- Verify that an AI update changes the visible Kanban board immediately.
- Check that the user can continue the conversation without losing context.

Success criteria:
- The user can interact with the AI in a sidebar chat.
- The AI may update the Kanban in response to prompts.
- UI refresh is immediate and reliable.

## Definition of done for the full MVP

- The app runs locally in Docker with a working backend and static frontend.
- A login flow protects the board behind dummy credentials.
- The board persists user data in SQLite.
- The frontend and backend are integrated end to end.
- The AI backend is connected through OpenRouter and can respond with structured output.
- The chat sidebar allows the AI to update the board and refresh the UI.
- The main workflows are covered by unit, integration, and backend tests.

## Notes

- Keep the implementation simple and avoid unnecessary abstraction.
- Prefer the smallest working solution that satisfies the stated MVP.
- Use the docs/ directory as the system of record for planning and decisions.
- Do not add speculative features beyond the approved scope.
