import hashlib
import hmac
import secrets
import sqlite3
import uuid
from contextlib import closing
from datetime import UTC, datetime, timedelta
from pathlib import Path

SESSION_DURATION = timedelta(days=30)
PASSWORD_ITERATIONS = 310_000

INITIAL_COLUMNS = (
    ("col-backlog", "Backlog", ("card-1", "card-2")),
    ("col-discovery", "Discovery", ("card-3",)),
    ("col-progress", "In Progress", ("card-4", "card-5")),
    ("col-review", "Review", ("card-6",)),
    ("col-done", "Done", ("card-7", "card-8")),
)

INITIAL_CARDS = {
    "card-1": (
        "Align roadmap themes",
        "Draft quarterly themes with impact statements and metrics.",
    ),
    "card-2": (
        "Gather customer signals",
        "Review support tags, sales notes, and churn feedback.",
    ),
    "card-3": (
        "Prototype analytics view",
        "Sketch initial dashboard layout and key drill-downs.",
    ),
    "card-4": (
        "Refine status language",
        "Standardize column labels and tone across the board.",
    ),
    "card-5": (
        "Design card layout",
        "Add hierarchy and spacing for scanning dense lists.",
    ),
    "card-6": (
        "QA micro-interactions",
        "Verify hover, focus, and loading states.",
    ),
    "card-7": (
        "Ship marketing page",
        "Final copy approved and asset pack delivered.",
    ),
    "card-8": (
        "Close onboarding sprint",
        "Document release notes and share internally.",
    ),
}

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS boards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS columns (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INTEGER NOT NULL,
    UNIQUE (board_id, id),
    UNIQUE (board_id, position)
);
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    board_id TEXT NOT NULL,
    column_id TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE,
    FOREIGN KEY (board_id, column_id)
        REFERENCES columns(board_id, id) ON DELETE CASCADE,
    UNIQUE (column_id, position)
);
CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx
    ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx
    ON auth_sessions(expires_at);
"""


def utc_now() -> datetime:
    return datetime.now(UTC)


def timestamp(value: datetime) -> str:
    return value.isoformat(timespec="seconds")


def connect(database_path: Path) -> sqlite3.Connection:
    connection = sqlite3.connect(database_path, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, PASSWORD_ITERATIONS
    )
    return f"pbkdf2_sha256${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored_hash: str) -> bool:
    algorithm, salt_hex, digest_hex = stored_hash.split("$", maxsplit=2)
    if algorithm != "pbkdf2_sha256":
        return False
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), PASSWORD_ITERATIONS
    )
    return hmac.compare_digest(digest.hex(), digest_hex)


def new_session_token() -> str:
    return secrets.token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def initialize_database(
    database_path: Path,
    username: str,
    password: str,
) -> None:
    database_path.parent.mkdir(parents=True, exist_ok=True)
    now = timestamp(utc_now())

    with closing(connect(database_path)) as connection, connection:
        connection.executescript(SCHEMA)
        user = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if user is None:
            connection.execute(
                """
                INSERT INTO users (id, username, password_hash, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (str(uuid.uuid4()), username, hash_password(password), now),
            )
            user = connection.execute(
                "SELECT id FROM users WHERE username = ?", (username,)
            ).fetchone()
        if user is None:
            raise RuntimeError("Unable to initialize the configured MVP user.")

        board = connection.execute(
            "SELECT id FROM boards WHERE user_id = ?", (user["id"],)
        ).fetchone()
        if board is None:
            board_id = str(uuid.uuid4())
            connection.execute(
                """
                INSERT INTO boards (id, user_id, title, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (board_id, user["id"], "Kanban Studio", now, now),
            )
            for position, (column_id, title, card_ids) in enumerate(INITIAL_COLUMNS):
                connection.execute(
                    """
                    INSERT INTO columns (id, board_id, title, position)
                    VALUES (?, ?, ?, ?)
                    """,
                    (column_id, board_id, title, position),
                )
                for card_position, card_id in enumerate(card_ids):
                    card_title, details = INITIAL_CARDS[card_id]
                    connection.execute(
                        """
                        INSERT INTO cards
                            (id, board_id, column_id, title, details, position,
                             created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            card_id,
                            board_id,
                            column_id,
                            card_title,
                            details,
                            card_position,
                            now,
                            now,
                        ),
                    )


def authenticate_user(
    connection: sqlite3.Connection, username: str, password: str
) -> sqlite3.Row | None:
    user = connection.execute(
        "SELECT id, username, password_hash FROM users WHERE username = ?",
        (username,),
    ).fetchone()
    if user is None or not verify_password(password, user["password_hash"]):
        return None
    return user


def create_session(
    connection: sqlite3.Connection, user_id: str
) -> tuple[str, datetime]:
    token = new_session_token()
    now = utc_now()
    expires_at = now + SESSION_DURATION
    connection.execute(
        """
        INSERT INTO auth_sessions (token_hash, user_id, created_at, expires_at)
        VALUES (?, ?, ?, ?)
        """,
        (
            hash_session_token(token),
            user_id,
            timestamp(now),
            timestamp(expires_at),
        ),
    )
    return token, expires_at
