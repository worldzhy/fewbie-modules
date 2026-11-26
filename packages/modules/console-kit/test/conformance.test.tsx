import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent } from "@testing/render";

import { PaginationBar, type PaginationBarLabels } from "../components/pagination-bar";
import { TableShell, type TableShellLabels } from "../components/table-shell";

const PAGINATION_LABELS: PaginationBarLabels = {
  previous: "Previous",
  next: "Next",
  pageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
  recordCount: (total) => `${total} records`,
};

const SHELL_LABELS: TableShellLabels = {
  loading: "Loading",
  emptyTitle: "Nothing yet",
  emptyDescription: "Adjust the filters.",
  errorTitle: "Could not load",
  retry: "Retry",
};

describe("pagination-bar conformance", () => {
  it("summarises the page and disables the edges", () => {
    render(<PaginationBar page={0} pageSize={20} total={45} onPageChange={() => {}} labels={PAGINATION_LABELS} />);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("45 records")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
  });

  it("reports the requested page", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<PaginationBar page={1} pageSize={20} total={45} onPageChange={onPageChange} labels={PAGINATION_LABELS} />);
    await user.click(screen.getByRole("button", { name: /Next/ }));
    expect(onPageChange).toHaveBeenCalledWith(2);
    await user.click(screen.getByRole("button", { name: /Previous/ }));
    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("clamps an out-of-range page", () => {
    render(<PaginationBar page={9} pageSize={20} total={5} onPageChange={() => {}} labels={PAGINATION_LABELS} />);
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <PaginationBar page={0} pageSize={20} total={45} onPageChange={() => {}} labels={PAGINATION_LABELS} />,
    );
    await expectNoViolations(container);
  });
});

describe("table-shell conformance", () => {
  it("renders the caller's table when ready", () => {
    render(
      <TableShell state="ready" labels={SHELL_LABELS}>
        <table>
          <tbody>
            <tr>
              <td>row</td>
            </tr>
          </tbody>
        </table>
      </TableShell>,
    );
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("replaces the table with the empty state", () => {
    render(<TableShell state="empty" labels={SHELL_LABELS} />);
    expect(screen.getByText("Nothing yet")).toBeInTheDocument();
    expect(screen.getByText("Adjust the filters.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error state with a retry", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<TableShell state="error" errorMessage="502" onRetry={onRetry} labels={SHELL_LABELS} />);
    expect(screen.getByText("Could not load")).toBeInTheDocument();
    expect(screen.getByText("502")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows the loading state", () => {
    render(<TableShell state="loading" labels={SHELL_LABELS} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container, rerender } = render(<TableShell state="empty" labels={SHELL_LABELS} />);
    await expectNoViolations(container);
    rerender(<TableShell state="error" labels={SHELL_LABELS} errorMessage="502" onRetry={() => {}} />);
    await expectNoViolations(container);
  });
});
