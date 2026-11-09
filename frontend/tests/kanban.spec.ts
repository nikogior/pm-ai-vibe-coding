import { expect, test } from "@playwright/test";
import { initialData, type BoardData } from "../src/lib/kanban";

const mockAuthenticationApi = async (
  page: import("@playwright/test").Page,
  emptyColumnId?: string
) => {
  let authenticated = false;
  let board: BoardData = structuredClone(initialData);
  if (emptyColumnId) {
    const emptyColumn = board.columns.find(
      (column) => column.id === emptyColumnId
    );
    if (!emptyColumn) {
      throw new Error(`Unknown test column: ${emptyColumnId}`);
    }
    const removedCardIds = emptyColumn.cardIds;
    emptyColumn.cardIds = [];
    for (const cardId of removedCardIds) {
      delete board.cards[cardId];
    }
  }
  await page.route("**/api/auth/**", async (route) => {
    const request = route.request();
    if (request.url().endsWith("/session")) {
      await route.fulfill({
        json: { authenticated, ...(authenticated ? { username: "user" } : {}) },
      });
    } else if (request.url().endsWith("/login")) {
      const credentials = request.postDataJSON() as {
        username: string;
        password: string;
      };
      if (credentials.username === "user" && credentials.password === "password") {
        authenticated = true;
        await route.fulfill({ json: { username: "user" } });
      } else {
        await route.fulfill({ status: 401, json: { detail: "Unauthorized" } });
      }
    } else if (request.url().endsWith("/logout")) {
      authenticated = false;
      await route.fulfill({ status: 204 });
    }
  });
  await page.route("**/api/board", async (route) => {
    if (route.request().method() === "PUT") {
      board = route.request().postDataJSON() as BoardData;
    }
    await route.fulfill({ json: board });
  });
  return {
    getBoard: () => board,
    setBoard: (nextBoard: BoardData) => {
      board = nextBoard;
    },
  };
};

const signIn = async (
  page: import("@playwright/test").Page,
  emptyColumnId?: string
) => {
  const api = await mockAuthenticationApi(page, emptyColumnId);
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  return api;
};

test("signs in, restores the session, and logs out", async ({ page }) => {
  await mockAuthenticationApi(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("loads the kanban board", async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
  await page.reload();
  await expect(
    page.locator('[data-testid^="column-"]').first().getByText("Playwright card")
  ).toBeVisible();
});

test("edits a card and retains the changes after reload", async ({ page }) => {
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  await card.getByRole("button", { name: "Edit Align roadmap themes" }).click();
  await page.getByLabel("Edit card title").fill("Updated roadmap");
  await page.getByLabel("Edit card details").fill("Updated project details.");
  await card.getByRole("button", { name: "Save changes" }).click();

  await expect(card.getByText("Updated roadmap")).toBeVisible();
  await expect(card.getByText("Updated project details.")).toBeVisible();
  await page.reload();
  const reloadedCard = page.getByTestId("card-card-1");
  await expect(reloadedCard.getByText("Updated roadmap")).toBeVisible();
  await expect(reloadedCard.getByText("Updated project details.")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  await targetColumn.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + Math.min(150, columnBox.height / 2),
    { steps: 15 }
  );
  await expect(targetColumn).toHaveClass(/ring-2/);
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1"))
    .toBeVisible();
});

test("highlights and accepts a drop into an empty column", async ({ page }) => {
  await signIn(page, "col-review");
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  await targetColumn.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + Math.min(150, columnBox.height / 2),
    { steps: 15 }
  );
  await expect(targetColumn).toHaveClass(/ring-2/);
  await page.mouse.up();

  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await page.reload();
  await expect(
    page.getByTestId("column-col-review").getByTestId("card-card-1")
  ).toBeVisible();
});

test("reorders cards when dropped over another card in the same column", async ({
  page,
}) => {
  await signIn(page);
  const firstColumn = page.getByTestId("column-col-backlog");
  const draggedCard = page.getByTestId("card-card-2");
  const targetCard = page.getByTestId("card-card-1");
  await draggedCard.scrollIntoViewIfNeeded();
  const draggedBox = await draggedCard.boundingBox();
  const targetBox = await targetCard.boundingBox();
  if (!draggedBox || !targetBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }
  await page.mouse.move(
    draggedBox.x + draggedBox.width / 2,
    draggedBox.y + draggedBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 12 }
  );
  await expect(draggedCard).toHaveClass(/opacity-60/);
  await page.mouse.up();

  const cardOrder = () =>
    firstColumn.locator("article[data-testid^='card-']").evaluateAll((cards) =>
      cards.map((card) => card.getAttribute("data-testid"))
    );
  await expect.poll(cardOrder).toEqual(["card-card-2", "card-card-1"]);
  await page.reload();
  await expect.poll(cardOrder).toEqual(["card-card-2", "card-card-1"]);
});

test("keeps chat history and applies AI board updates immediately", async ({
  page,
}) => {
  const api = await signIn(page);
  const requests: Array<{ message: string; history: unknown[] }> = [];
  await page.route("**/api/ai/chat", async (route) => {
    const request = route.request().postDataJSON() as {
      message: string;
      history: unknown[];
    };
    requests.push(request);
    if (requests.length === 1) {
      await route.fulfill({
        json: { type: "reply", message: "There are eight cards." },
      });
      return;
    }

    const updatedBoard = structuredClone(api.getBoard());
    updatedBoard.cards["card-1"].title = "AI-updated roadmap";
    api.setBoard(updatedBoard);
    await route.fulfill({
      json: {
        type: "board_update",
        message: "I updated the roadmap card.",
        board: updatedBoard,
      },
    });
  });

  const chat = page.getByRole("complementary", { name: "AI assistant" });
  const input = chat.getByRole("textbox", { name: "Message the AI" });
  await input.fill("How many cards are on the board?");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(chat.getByText("There are eight cards.")).toBeVisible();

  await input.fill("Rename card one to AI-updated roadmap.");
  await chat.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("card-card-1").getByText("AI-updated roadmap"))
    .toBeVisible();
  await expect(chat.getByText("I updated the roadmap card.")).toBeVisible();
  expect(requests[1].history).toEqual([
    { role: "user", content: "How many cards are on the board?" },
    { role: "assistant", content: "There are eight cards." },
  ]);

  await page.reload();
  await expect(page.getByTestId("card-card-1").getByText("AI-updated roadmap"))
    .toBeVisible();
});

test("shows AI request errors and keeps the prompt available to retry", async ({
  page,
}) => {
  await signIn(page);
  await page.route("**/api/ai/chat", async (route) => {
    await route.fulfill({
      status: 502,
      json: { detail: "Could not reach OpenRouter." },
    });
  });

  const chat = page.getByRole("complementary", { name: "AI assistant" });
  const input = chat.getByRole("textbox", { name: "Message the AI" });
  await input.fill("Summarize my board.");
  await chat.getByRole("button", { name: "Send" }).click();

  await expect(chat.getByRole("alert")).toHaveText("Could not reach OpenRouter.");
  await expect(input).toHaveValue("Summarize my board.");
});
