import { expect, test } from "@playwright/test";
import { initialData, type BoardData } from "../src/lib/kanban";

const mockAuthenticationApi = async (page: import("@playwright/test").Page) => {
  let authenticated = false;
  let board: BoardData = structuredClone(initialData);
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
};

const signIn = async (page: import("@playwright/test").Page) => {
  await mockAuthenticationApi(page);
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
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
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("column-col-review").getByTestId("card-card-1"))
    .toBeVisible();
});
