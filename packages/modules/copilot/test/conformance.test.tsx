import { describe, expect, it, vi } from "vitest";

import { makeLabels } from "@testing/labels";
import { render, screen, userEvent, waitFor } from "@testing/render";
import { CopilotDock } from "../src/fewbie/modules/copilot/widgets/copilot/copilot-dock";
import type {
  CopilotAgentEvent,
  CopilotLabels,
  CopilotPort,
  CopilotSendInput,
  CopilotSkillsCatalog,
} from "../src/fewbie/modules/copilot/widgets/copilot/types";

const CATALOG: CopilotSkillsCatalog = {
  v: 1,
  skills: [
    {
      name: "list_aws_accounts",
      description: "Lists accounts",
      resultHint: { kind: "list", description: "account rows" },
      relevant: true,
    },
  ],
  recommendedPrompts: [{ label: "Summarize", prompt: "Summarize this page" }],
};

function setup(send?: (input: CopilotSendInput) => Promise<void>) {
  const port: CopilotPort = {
    send: vi.fn(send ?? (async () => undefined)),
    confirm: vi.fn().mockResolvedValue(undefined),
    fetchCatalog: vi.fn().mockResolvedValue(CATALOG),
  };
  const onOpenLink = vi.fn();
  render(
    <CopilotDock
      labels={makeLabels<CopilotLabels>()}
      port={port}
      open
      onClose={vi.fn()}
      pageContext={{ route: "/accounts" }}
      onOpenLink={onOpenLink}
      onNavigate={vi.fn()}
    />,
  );
  return { port, onOpenLink, user: userEvent.setup() };
}

function emit(input: CopilotSendInput, ...events: CopilotAgentEvent[]) {
  for (const event of events) input.onEvent(event);
}

describe("copilot conformance", () => {
  it("renders the empty state with humanized capabilities", async () => {
    setup();
    expect(await screen.findByText("label:emptyIntro")).toBeInTheDocument();
    expect(await screen.findByText("List AWS Accounts")).toBeInTheDocument();
  });

  it("sends the drafted message through the port and renders streamed text", async () => {
    const { port, user } = setup(async (input) => {
      emit(input, { v: 1, type: "text-delta", text: "hello there" });
    });
    const textarea = screen.getByRole("textbox");
    await user.type(textarea, "ask{enter}");
    expect(await screen.findByText("hello there")).toBeInTheDocument();
    expect(port.send).toHaveBeenCalledWith(
      expect.objectContaining({ message: "ask", pageContext: { route: "/accounts" } }),
    );
  });

  it("renders an error event as the failed label", async () => {
    const { user } = setup(async (input) => {
      emit(input, { v: 1, type: "failed", requestId: "r1", code: "provider_error", message: "upstream" });
    });
    await user.type(screen.getByRole("textbox"), "ask{enter}");
    expect(await screen.findByText("Provider Error")).toBeInTheDocument();
    expect(await screen.findByText("upstream")).toBeInTheDocument();
  });

  it("shows a confirmation card and resolves it through the port", async () => {
    const { port, user } = setup(async (input) => {
      emit(
        input,
        {
          v: 1,
          type: "tool-started",
          toolCallId: "t1",
          name: "restart_service",
          inputSummary: '{"service":"api"}',
        },
        {
          v: 1,
          type: "confirm-required",
          confirmationId: "c1",
          toolCallId: "t1",
          name: "restart_service",
          arguments: { service: "api" },
        },
      );
    });
    await user.type(screen.getByRole("textbox"), "restart{enter}");
    const confirm = await screen.findByRole("button", { name: "label:confirm" });
    await user.click(confirm);
    await waitFor(() => expect(port.confirm).toHaveBeenCalledWith({ confirmationId: "c1", decision: "confirmed" }));
  });
});
