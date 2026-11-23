import { describe, expect, it, vi } from "vitest";

import { expectNoViolations } from "@testing/a11y";
import { render, screen, userEvent } from "@testing/render";

import { ThemeProvider } from "../src/fewbie/modules/theme/components/theme-provider";
import { ThemeToggle } from "../src/fewbie/modules/theme/components/theme-toggle";

const { themeState, setThemeMock } = vi.hoisted(() => ({
  themeState: { resolvedTheme: "light" as string | undefined },
  setThemeMock: vi.fn(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: themeState.resolvedTheme, setTheme: setThemeMock }),
  ThemeProvider: ({ children }: { children: unknown }) => children,
}));

describe("theme conformance", () => {
  it("renders the host label as the toggle's accessible name", () => {
    render(<ThemeToggle label="切换主题" />);
    expect(screen.getByRole("button", { name: "切换主题" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Toggle theme" })).not.toBeInTheDocument();
  });

  it("falls back to the English label", () => {
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Toggle theme" })).toBeInTheDocument();
  });

  it("switches to dark from a light theme", async () => {
    themeState.resolvedTheme = "light";
    setThemeMock.mockReset();
    render(<ThemeToggle />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(setThemeMock).toHaveBeenCalledWith("dark");
  });

  it("switches to light from a dark theme", async () => {
    themeState.resolvedTheme = "dark";
    setThemeMock.mockReset();
    render(<ThemeToggle />);
    await userEvent.setup().click(screen.getByRole("button"));
    expect(setThemeMock).toHaveBeenCalledWith("light");
  });

  it("renders its children through the provider wrapper", () => {
    render(
      <ThemeProvider attribute="class">
        <span>host shell</span>
      </ThemeProvider>,
    );
    expect(screen.getByText("host shell")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ThemeToggle />);
    await expectNoViolations(container);
  });
});
