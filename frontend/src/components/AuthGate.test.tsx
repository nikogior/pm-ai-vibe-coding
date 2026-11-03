import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

const SESSION_KEY = "pm-ai-vibe-coding-user";

describe("AuthGate", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("only opens the board with valid credentials and logs out", async () => {
    const user = userEvent.setup();
    render(<AuthGate />);

    await user.type(await screen.findByLabelText("Username"), "wrong");
    await user.type(screen.getByLabelText("Password"), "credentials");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Incorrect username or password."
    );
    expect(screen.queryByRole("heading", { name: "Kanban Studio" })).toBeNull();

    await user.clear(screen.getByLabelText("Username"));
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Username"), "user");
    await user.type(screen.getByLabelText("Password"), "password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
    expect(localStorage.getItem(SESSION_KEY)).toBe("user");

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeVisible();
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  });

  it("restores a signed-in session", async () => {
    localStorage.setItem(SESSION_KEY, "user");
    render(<AuthGate />);

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });
});
