import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KanbanBoard } from "@/components/KanbanBoard";
import { initialData, type BoardData } from "@/lib/kanban";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];
const apiResponse = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

describe("KanbanBoard", () => {
  let savedBoard: BoardData;

  beforeEach(() => {
    savedBoard = structuredClone(initialData);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PUT") {
          savedBoard = JSON.parse(String(init.body)) as BoardData;
          return apiResponse(savedBoard);
        }
        return apiResponse(savedBoard);
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads five columns from the backend", async () => {
    render(<KanbanBoard />);
    expect(await screen.findAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
    await waitFor(() => {
      expect(savedBoard.columns[0].title).toBe("New Name");
    });
  });

  it("adds and removes a card", async () => {
    render(<KanbanBoard />);
    await screen.findByTestId("column-col-backlog");
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();
    await waitFor(() => {
      expect(
        Object.values(savedBoard.cards).some((card) => card.title === "New card")
      ).toBe(true);
    });

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(
        Object.values(savedBoard.cards).some((card) => card.title === "New card")
      ).toBe(false);
    });
  });

  it("edits a card and persists its title and details", async () => {
    render(<KanbanBoard />);
    const card = await screen.findByTestId("card-card-1");

    await userEvent.click(within(card).getByRole("button", { name: "Edit Align roadmap themes" }));
    await userEvent.clear(screen.getByLabelText("Edit card title"));
    await userEvent.type(screen.getByLabelText("Edit card title"), "Updated roadmap");
    await userEvent.clear(screen.getByLabelText("Edit card details"));
    await userEvent.type(screen.getByLabelText("Edit card details"), "New details");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));

    expect(within(card).getByText("Updated roadmap")).toBeInTheDocument();
    expect(within(card).getByText("New details")).toBeInTheDocument();
    await waitFor(() => {
      expect(savedBoard.cards["card-1"]).toMatchObject({
        title: "Updated roadmap",
        details: "New details",
      });
    });
  });
});
