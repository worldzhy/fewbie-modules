import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent, waitFor } from "@testing/render";

import { AuditLogPage } from "../features/audit-log";
import type { AuditLogLabels, AuditLogPort, AuditLogProps } from "../features/audit-log/types";
import type { AuditLogPageResult, AuditLogRecord } from "../lib/types";

const LABELS: AuditLogLabels = {
  title: "Audit log",
  subtitle: "Every recorded platform action.",
  filterKeyword: "Keyword",
  filterKeywordPlaceholder: "Search events",
  filterEvent: "Event",
  filterEventPlaceholder: "e.g. user.login",
  filterAction: "Action",
  filterActionPlaceholder: "e.g. update",
  filterResourceType: "Resource type",
  filterResourceTypePlaceholder: "e.g. user",
  filterResourceId: "Resource ID",
  filterResourceIdPlaceholder: "Exact id",
  filterActorId: "Actor ID",
  filterActorIdPlaceholder: "Who acted",
  filterResult: "Result",
  filterStartTime: "From",
  filterEndTime: "To",
  apply: "Apply",
  reset: "Reset",
  loading: "Loading audit log",
  emptyTitle: "No audit records",
  emptyDescription: "Adjust the filters.",
  errorTitle: "Could not load the audit log",
  retry: "Retry",
  colTime: "Time",
  colActor: "Actor",
  colEvent: "Event",
  colAction: "Action",
  colResourceType: "Resource type",
  colResourceId: "Resource ID",
  colResult: "Result",
  colDetail: "Detail",
  resultAll: "All results",
  resultSuccess: "Success",
  resultFailure: "Failure",
  viewDetail: "View detail",
  detailTitle: "Audit record detail",
  detailEmpty: "No detail recorded.",
  close: "Close",
  previous: "Previous",
  next: "Next",
  pageOf: (page, totalPages) => `Page ${page} of ${totalPages}`,
  recordCount: (total) => `${total} records`,
};

const RECORDS: AuditLogRecord[] = [
  {
    id: 1,
    event: "user.login",
    action: "login",
    resourceType: "user",
    resourceId: "u-1",
    actorId: "actor-1",
    result: "success",
    createdAt: "2026-01-01T00:00:00.000Z",
    detail: { ip: "10.0.0.1" },
  },
  {
    id: 2,
    event: "user.delete",
    action: "delete",
    resourceType: "user",
    resourceId: "u-2",
    actorId: null,
    result: "failure",
    createdAt: "2026-01-02T00:00:00.000Z",
  },
];

function pageResult(records: AuditLogRecord[], total = records.length): AuditLogPageResult {
  return { records, total };
}

type PageOptions = Omit<AuditLogProps, "labels" | "port" | "formatTime">;

function setup(port: AuditLogPort, options: PageOptions = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = userEvent.setup();
  const view = render(
    <QueryClientProvider client={client}>
      <AuditLogPage labels={LABELS} port={port} formatTime={(iso) => `t:${iso}`} {...options} />
    </QueryClientProvider>,
  );
  return { ...view, user, client };
}

describe("console-audit-log conformance", () => {
  it("renders one row per record in the ready state", async () => {
    setup({ fetchPage: vi.fn().mockResolvedValue(pageResult(RECORDS)) });

    expect(await screen.findByText("user.login")).toBeInTheDocument();
    expect(screen.getByText("user.delete")).toBeInTheDocument();
    // One header row plus one row per record.
    expect(screen.getAllByRole("row")).toHaveLength(RECORDS.length + 1);
    expect(screen.getByText("t:2026-01-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument();
    expect(screen.getByText("2 records")).toBeInTheDocument();
  });

  it("shows the empty state when the page has no records", async () => {
    setup({ fetchPage: vi.fn().mockResolvedValue(pageResult([])) });

    expect(await screen.findByText(LABELS.emptyTitle)).toBeInTheDocument();
    expect(screen.getByText(LABELS.emptyDescription)).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the error state and refetches on retry", async () => {
    const fetchPage = vi
      .fn<AuditLogPort["fetchPage"]>()
      .mockRejectedValueOnce(new Error("audit down"))
      .mockResolvedValue(pageResult(RECORDS));
    const { user } = setup({ fetchPage });

    expect(await screen.findByText(LABELS.errorTitle)).toBeInTheDocument();
    expect(screen.getByText("audit down")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: LABELS.retry }));

    await waitFor(() => expect(fetchPage).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("user.login")).toBeInTheDocument();
  });

  it("shows the detail payload as JSON and falls back to the empty copy", async () => {
    const { user } = setup({ fetchPage: vi.fn().mockResolvedValue(pageResult(RECORDS)) });

    await screen.findByText("user.login");
    const detailButtons = screen.getAllByRole("button", { name: LABELS.viewDetail });

    await user.click(detailButtons[0]);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/"ip": "10\.0\.0\.1"/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: LABELS.close }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(detailButtons[1]);
    expect(screen.getByText(LABELS.detailEmpty)).toBeInTheDocument();
  });

  it("requests the next page when the pager advances", async () => {
    const fetchPage = vi.fn<AuditLogPort["fetchPage"]>().mockResolvedValue(pageResult(RECORDS, 4));
    const { user } = setup({ fetchPage }, { pageSize: 1 });

    await screen.findByText("user.login");
    await user.click(screen.getByRole("button", { name: new RegExp(LABELS.next) }));

    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, pageSize: 1 })));
  });

  it("applies the filters at page 0 and keeps the fields the user typed", async () => {
    const fetchPage = vi.fn<AuditLogPort["fetchPage"]>().mockResolvedValue(pageResult(RECORDS, 4));
    const { user } = setup({ fetchPage }, { pageSize: 1 });

    await screen.findByText("user.login");
    await user.click(screen.getByRole("button", { name: new RegExp(LABELS.next) }));
    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));

    await user.type(screen.getByLabelText(LABELS.filterKeyword), "alice");
    await user.type(screen.getByLabelText(LABELS.filterActorId), "actor-9");
    await user.selectOptions(screen.getByLabelText(LABELS.filterResult), "failure");
    await user.click(screen.getByRole("button", { name: LABELS.apply }));

    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 0, keyword: "alice", actorId: "actor-9", result: "failure" }),
      ),
    );
  });

  it("clears every filter and the page on reset", async () => {
    const fetchPage = vi.fn<AuditLogPort["fetchPage"]>().mockResolvedValue(pageResult(RECORDS, 4));
    const { user } = setup({ fetchPage }, { pageSize: 1, initialQuery: { keyword: "old", page: 2 } });

    await screen.findByText("user.login");
    expect(screen.getByLabelText(LABELS.filterKeyword)).toHaveValue("old");

    await user.click(screen.getByRole("button", { name: LABELS.reset }));

    await waitFor(() => expect(fetchPage).toHaveBeenLastCalledWith(expect.objectContaining({ page: 0 })));
    expect(screen.getByLabelText(LABELS.filterKeyword)).toHaveValue("");
    expect(fetchPage.mock.lastCall?.[0]).not.toHaveProperty("keyword");
  });

  it("publishes the normalized query to the host", async () => {
    const onQueryChange = vi.fn();
    setup(
      { fetchPage: vi.fn().mockResolvedValue(pageResult(RECORDS)) },
      { onQueryChange, initialQuery: { event: "  user.login  " } },
    );

    await waitFor(() =>
      expect(onQueryChange).toHaveBeenCalledWith(
        expect.objectContaining({ page: 0, pageSize: 20, event: "user.login" }),
      ),
    );
  });

  it("reports a new transport error once", async () => {
    const onError = vi.fn();
    const failure = new Error("audit down");
    setup({ fetchPage: vi.fn().mockRejectedValue(failure) }, { onError });

    await screen.findByText(LABELS.errorTitle);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError).toHaveBeenCalledWith(failure);
  });

  it("has no accessibility violations in the ready state", async () => {
    const { container } = setup({ fetchPage: vi.fn().mockResolvedValue(pageResult(RECORDS)) });

    await screen.findByText("user.login");
    await expectNoViolations(container);
  });
});
