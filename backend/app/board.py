import sqlite3
from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class Card(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    details: str


class Column(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    title: str
    card_ids: list[str] = Field(alias="cardIds")


class Board(BaseModel):
    model_config = ConfigDict(extra="forbid")

    columns: list[Column] = Field(min_length=1)
    cards: dict[str, Card]

    @model_validator(mode="after")
    def validate_card_membership(self) -> "Board":
        column_ids = [column.id for column in self.columns]
        if len(column_ids) != len(set(column_ids)):
            raise ValueError("Column ids must be unique.")

        placed_cards = [
            card_id for column in self.columns for card_id in column.card_ids
        ]
        if len(placed_cards) != len(set(placed_cards)):
            raise ValueError("Each card must appear in only one column.")
        if set(placed_cards) != set(self.cards):
            raise ValueError("Every card must appear in exactly one column.")
        if any(card_id != card.id for card_id, card in self.cards.items()):
            raise ValueError("Card ids must match their object keys.")
        return self


def read_board(connection: sqlite3.Connection, user_id: str) -> Board:
    board = connection.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if board is None:
        raise LookupError("Board not found for user.")

    column_rows = connection.execute(
        """
        SELECT id, title FROM columns
        WHERE board_id = ? ORDER BY position
        """,
        (board["id"],),
    ).fetchall()
    card_rows = connection.execute(
        """
        SELECT id, column_id, title, details FROM cards
        WHERE board_id = ? ORDER BY column_id, position
        """,
        (board["id"],),
    ).fetchall()

    card_ids_by_column: dict[str, list[str]] = {
        row["id"]: [] for row in column_rows
    }
    cards: dict[str, Card] = {}
    for row in card_rows:
        cards[row["id"]] = Card(
            id=row["id"], title=row["title"], details=row["details"]
        )
        card_ids_by_column[row["column_id"]].append(row["id"])

    return Board(
        columns=[
            Column(
                id=row["id"],
                title=row["title"],
                cardIds=card_ids_by_column[row["id"]],
            )
            for row in column_rows
        ],
        cards=cards,
    )


def write_board(
    connection: sqlite3.Connection, user_id: str, new_board: Board
) -> Board:
    current_board = connection.execute(
        "SELECT id FROM boards WHERE user_id = ?", (user_id,)
    ).fetchone()
    if current_board is None:
        raise LookupError("Board not found for user.")

    board_id = current_board["id"]
    current_column_ids = [
        row["id"]
        for row in connection.execute(
            "SELECT id FROM columns WHERE board_id = ? ORDER BY position",
            (board_id,),
        ).fetchall()
    ]
    if [column.id for column in new_board.columns] != current_column_ids:
        raise ValueError("The fixed board columns cannot be added, removed, or reordered.")

    now = datetime.now(UTC).isoformat(timespec="seconds")
    existing_card_dates = {
        row["id"]: row["created_at"]
        for row in connection.execute(
            "SELECT id, created_at FROM cards WHERE board_id = ?", (board_id,)
        ).fetchall()
    }
    connection.execute("DELETE FROM cards WHERE board_id = ?", (board_id,))
    for column_position, column in enumerate(new_board.columns):
        connection.execute(
            "UPDATE columns SET title = ? WHERE board_id = ? AND id = ?",
            (column.title, board_id, column.id),
        )
        for card_position, card_id in enumerate(column.card_ids):
            card = new_board.cards[card_id]
            connection.execute(
                """
                INSERT INTO cards
                    (id, board_id, column_id, title, details, position,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    card.id,
                    board_id,
                    column.id,
                    card.title,
                    card.details,
                    card_position,
                    existing_card_dates.get(card.id, now),
                    now,
                ),
            )
        connection.execute(
            """
            UPDATE columns SET position = ?
            WHERE board_id = ? AND id = ?
            """,
            (column_position, board_id, column.id),
        )
    connection.execute(
        "UPDATE boards SET updated_at = ? WHERE id = ?", (now, board_id)
    )
    return read_board(connection, user_id)
