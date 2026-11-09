import os
import sqlite3
from collections.abc import AsyncIterator, Generator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Request, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, ConfigDict

from app.ai import (
    AIChatRequest,
    AIResponse,
    AIBoardUpdate,
    CONNECTIVITY_PROMPT,
    OpenRouterConfigurationError,
    OpenRouterRequestError,
    ask_openrouter,
    chat_with_board,
)
from app.board import Board, read_board, write_board
from app.database import (
    SESSION_DURATION,
    authenticate_user,
    connect,
    create_session,
    hash_session_token,
    initialize_database,
)

BASE_DIR = Path(__file__).resolve().parents[2]
FRONTEND_DIR = BASE_DIR / "frontend" / "out"
DEFAULT_DATABASE_PATH = BASE_DIR / "data" / "kanban.sqlite3"
DATABASE_PATH = Path(os.environ.get("DATABASE_PATH", DEFAULT_DATABASE_PATH))
USERNAME = os.environ.get("APP_USERNAME", "user")
PASSWORD = os.environ.get("APP_PASSWORD", "password")
SESSION_COOKIE = "pm_ai_vibe_coding_session"
SESSION_MAX_AGE = int(SESSION_DURATION.total_seconds())


class LoginRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    username: str
    password: str


def create_app(
    database_path: Path = DATABASE_PATH,
    username: str = USERNAME,
    password: str = PASSWORD,
    frontend_dir: Path = FRONTEND_DIR,
) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        initialize_database(database_path, username, password)
        yield

    application = FastAPI(title="PM AI Vibe Coding API", lifespan=lifespan)

    def get_connection() -> Generator[sqlite3.Connection, None, None]:
        connection = connect(database_path)
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    Connection = Annotated[sqlite3.Connection, Depends(get_connection)]

    def require_user_id(
        request: Request,
        connection: Connection,
    ) -> str:
        token = request.cookies.get(SESSION_COOKIE)
        if token is None:
            raise HTTPException(status_code=401, detail="Authentication required.")

        token_hash = hash_session_token(token)
        session = connection.execute(
            """
            SELECT user_id, expires_at FROM auth_sessions
            WHERE token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if session is None:
            raise HTTPException(status_code=401, detail="Session is invalid.")

        now = datetime.now(UTC).isoformat(timespec="seconds")
        if session["expires_at"] <= now:
            raise HTTPException(status_code=401, detail="Session has expired.")
        return str(session["user_id"])

    CurrentUser = Annotated[str, Depends(require_user_id)]

    @application.get("/health")
    async def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @application.get("/api/hello")
    async def hello_world() -> dict[str, str]:
        return {"message": "Hello from FastAPI", "status": "ok"}

    @application.post("/api/ai/connectivity")
    async def ai_connectivity(user_id: CurrentUser) -> dict[str, str]:
        try:
            response = await ask_openrouter(CONNECTIVITY_PROMPT)
        except OpenRouterConfigurationError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except OpenRouterRequestError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error
        return {"response": response}

    @application.post("/api/ai/chat", response_model=AIResponse)
    async def ai_chat(
        payload: AIChatRequest,
        connection: Connection,
        user_id: CurrentUser,
    ) -> AIResponse:
        try:
            current_board = read_board(connection, user_id)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

        try:
            ai_response = await chat_with_board(
                payload.message,
                payload.history,
                current_board,
            )
        except OpenRouterConfigurationError as error:
            raise HTTPException(status_code=503, detail=str(error)) from error
        except OpenRouterRequestError as error:
            raise HTTPException(status_code=502, detail=str(error)) from error

        if isinstance(ai_response, AIBoardUpdate):
            if read_board(connection, user_id) != current_board:
                raise HTTPException(
                    status_code=409,
                    detail="Board changed while AI was processing; retry the request.",
                )
            try:
                saved_board = write_board(connection, user_id, ai_response.board)
            except ValueError as error:
                raise HTTPException(
                    status_code=502,
                    detail="AI response contains an invalid board update.",
                ) from error
            ai_response = ai_response.model_copy(update={"board": saved_board})

        return ai_response

    @application.post("/api/auth/login")
    async def login(
        payload: LoginRequest,
        response: Response,
        connection: Connection,
    ) -> dict[str, str]:
        user = authenticate_user(connection, payload.username, payload.password)
        if user is None:
            raise HTTPException(status_code=401, detail="Incorrect username or password.")

        token, _ = create_session(connection, str(user["id"]))
        response.set_cookie(
            key=SESSION_COOKIE,
            value=token,
            max_age=SESSION_MAX_AGE,
            httponly=True,
            secure=os.environ.get("COOKIE_SECURE", "").lower() == "true",
            samesite="lax",
            path="/",
        )
        return {"username": str(user["username"])}

    @application.get("/api/auth/session")
    async def session_status(
        request: Request,
        connection: Connection,
    ) -> dict[str, str | bool]:
        token = request.cookies.get(SESSION_COOKIE)
        if token is None:
            return {"authenticated": False}

        token_hash = hash_session_token(token)
        session = connection.execute(
            """
            SELECT users.username, auth_sessions.expires_at
            FROM auth_sessions
            JOIN users ON users.id = auth_sessions.user_id
            WHERE auth_sessions.token_hash = ?
            """,
            (token_hash,),
        ).fetchone()
        if session is None:
            return {"authenticated": False}

        now = datetime.now(UTC).isoformat(timespec="seconds")
        if session["expires_at"] <= now:
            connection.execute(
                "DELETE FROM auth_sessions WHERE token_hash = ?", (token_hash,)
            )
            return {"authenticated": False}

        return {"authenticated": True, "username": str(session["username"])}

    @application.post("/api/auth/logout", status_code=204)
    async def logout(
        request: Request,
        connection: Connection,
    ) -> Response:
        token = request.cookies.get(SESSION_COOKIE)
        if token is not None:
            connection.execute(
                "DELETE FROM auth_sessions WHERE token_hash = ?",
                (hash_session_token(token),),
            )
        logout_response = Response(status_code=204)
        logout_response.delete_cookie(
            key=SESSION_COOKIE,
            httponly=True,
            secure=os.environ.get("COOKIE_SECURE", "").lower() == "true",
            samesite="lax",
            path="/",
        )
        return logout_response

    @application.get("/api/board", response_model=Board)
    async def get_board(
        connection: Connection,
        user_id: CurrentUser,
    ) -> Board:
        try:
            return read_board(connection, user_id)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @application.put("/api/board", response_model=Board)
    async def put_board(
        payload: Board,
        connection: Connection,
        user_id: CurrentUser,
    ) -> Board:
        try:
            return write_board(connection, user_id, payload)
        except LookupError as error:
            raise HTTPException(status_code=404, detail=str(error)) from error
        except ValueError as error:
            raise HTTPException(status_code=422, detail=str(error)) from error

    application.mount(
        "/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend"
    )
    return application


app = create_app()
