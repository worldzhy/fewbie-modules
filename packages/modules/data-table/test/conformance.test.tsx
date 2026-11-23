import { describe, expect, it } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent, within } from "@testing/render";

import { DataTable, type Column } from "../src/fewbie/modules/data-table/components/data-table";

interface Row extends Record<string, unknown> {
  name: string;
  score: number;
}

const COLUMNS: Column<Row>[] = [
  { accessorKey: "name", header: "Name" },
  { accessorKey: "score", header: "Score" },
];

const ROWS: Row[] = [
  { name: "beta", score: 2 },
  { name: "alpha", score: 3 },
  { name: "gamma", score: 1 },
];

function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

describe("data-table conformance", () => {
  it("renders headers and every row", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} />);
    expect(screen.getByRole("button", { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Score/ })).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(3);
  });

  it("sorts by a column and toggles the direction", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={COLUMNS} data={ROWS} />);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(bodyRows().map((row) => row.textContent)).toEqual(["alpha3", "beta2", "gamma1"]);
    await user.click(screen.getByRole("button", { name: /Name/ }));
    expect(bodyRows().map((row) => row.textContent)).toEqual(["gamma1", "beta2", "alpha3"]);
  });

  it("leaves a column unsorted when sorting is disabled", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={[{ accessorKey: "name", header: "Name", enableSorting: false }]} data={ROWS} />);
    expect(screen.queryByRole("button", { name: /Name/ })).not.toBeInTheDocument();
    await user.click(screen.getByText("Name"));
    expect(bodyRows()).toHaveLength(3);
  });

  it("paginates and announces the visible range", async () => {
    const user = userEvent.setup();
    render(<DataTable columns={COLUMNS} data={ROWS} pageSize={2} />);
    expect(bodyRows()).toHaveLength(2);
    expect(screen.getByText("1–2 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(bodyRows()).toHaveLength(1);
    expect(screen.getByText("3–3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("honours host-supplied copy", () => {
    render(
      <DataTable
        columns={COLUMNS}
        data={[]}
        labels={{ empty: "Nothing here", range: (from, to, total) => `${from}/${to}/${total}` }}
      />,
    );
    expect(screen.getByText("Nothing here")).toBeInTheDocument();
  });

  it("renders a custom cell", () => {
    render(
      <DataTable
        columns={[{ accessorKey: "score", header: "Score", cell: (value) => <strong>score:{String(value)}</strong> }]}
        data={ROWS}
      />,
    );
    expect(screen.getAllByText(/^score:/)).toHaveLength(3);
  });

  it("has no accessibility violations", async () => {
    const { container, rerender } = render(<DataTable columns={COLUMNS} data={ROWS} pageSize={2} />);
    await expectNoViolations(container);
    rerender(<DataTable columns={COLUMNS} data={[]} />);
    await expectNoViolations(container);
  });
});

describe("data-table a11y wiring", () => {
  it("keeps the table reachable by name", () => {
    render(<DataTable columns={COLUMNS} data={ROWS} />);
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(4);
  });
});
