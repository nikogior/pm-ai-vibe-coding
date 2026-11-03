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
- [ ] Define the board, cards, columns, and user data model.
- [ ] Design the schema to support multiple users and one board per user in the MVP.
- [ ] Save the proposed schema as a JSON document in docs/.
- [ ] Document assumptions for future extension and migrations.
- [ ] Present the database design to the user and wait for approval.

Validation:
- Check the JSON schema against the MVP requirements.
- Confirm keys and relations cover board state and user ownership.
- Ensure the schema is simple enough for SQLite without overengineering.

Success criteria:
- The schema is agreed, documented, and ready for backend implementation.
- The user approves the chosen persistence approach.

## Part 6: Backend API and persistence

Purpose: implement the API layer to read and update board state for a user and create the database if it is missing.

Checklist:
- [ ] Create the database if it does not exist.
- [ ] Define the SQLite tables and initialization logic.
- [ ] Add API routes for loading the board for a user.
- [ ] Add API routes for creating, updating, renaming, and moving cards.
- [ ] Add API routes for renaming columns and deleting cards.
- [ ] Write backend unit tests covering each route and edge case.

Validation:
- Run the backend test suite.
- Test CRUD and state persistence with SQLite.
- Verify the database is created automatically on first run.

Success criteria:
- The backend can fully represent the user’s board state.
- The app stores data in SQLite and loads it on subsequent sessions.
- Backend tests pass reliably.

## Part 7: Frontend + backend integration

Purpose: replace the demo-only in-memory board with data from the backend.

Checklist:
- [ ] Update the frontend to fetch board data from the backend.
- [ ] Submit card moves, edits, renames, and creation to the API.
- [ ] Handle loading and error states gracefully.
- [ ] Refresh the board after successful mutations.
- [ ] Add integration tests for the end-to-end board workflow.

Validation:
- Run the frontend and backend tests together.
- Manually verify that board changes persist after reload.
- Confirm the frontend reflects API state changes correctly.

Success criteria:
- The board is no longer static or local-only.
- Changes persist across sessions for the signed-in user.
- UI and API behavior are covered by tests.

## Part 8: AI connectivity

Purpose: establish OpenRouter connectivity and confirm the backend can call the configured model.

Checklist:
- [ ] Add the OpenRouter configuration and environment handling.
- [ ] Test a basic AI request such as 2 + 2.
- [ ] Validate required environment variables and error handling.
- [ ] Confirm the backend can respond with the model output in a stable way.

Validation:
- Execute a simple AI connectivity test in the backend.
- Validate the response format and error handling.
- Confirm the API key is used only from the environment config.

Success criteria:
- The model is reachable and returns a valid response.
- The app can integrate a real AI call as a backend service.

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
