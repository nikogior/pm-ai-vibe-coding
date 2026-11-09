import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";
import { initialData } from "@/lib/kanban";

const response = (status: number, body?: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe("AuthGate", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.mocked(fetch).mockResolvedValue(
      response(200, { authenticated: false })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("only opens the board with valid credentials and logs out", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch)
      .mockResolvedValueOnce(response(200, { authenticated: false }))
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { username: "user" }))
      .mockResolvedValueOnce(response(200, initialData))
      .mockResolvedValueOnce(response(204));
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

    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeVisible();
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({ method: "POST" })
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/auth/logout",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("restores a signed-in session", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      response(200, { authenticated: true, username: "user" })
    ).mockResolvedValueOnce(response(200, initialData));
    render(<AuthGate />);

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
  });

  it("reports an unavailable authentication service", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network unavailable"));
    render(<AuthGate />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to check sign-in session."
    );
  });
});
