import type { CSSProperties, ReactNode } from "react";

/**
 * The night palette used by the sign-in surface. Hosts install the module and
 * get the look without adopting a global theme: the tokens below only cascade
 * inside the shell, so the rest of the host keeps its own design system.
 */
const NIGHT_THEME = {
  "--background": "#0d1117",
  "--foreground": "#e6ecf7",
  "--card": "#151b24",
  "--card-foreground": "#edf2f7",
  "--popover": "#151b24",
  "--popover-foreground": "#edf2f7",
  "--primary": "#3b82f6",
  "--primary-foreground": "#ffffff",
  "--secondary": "#1c2430",
  "--secondary-foreground": "#b5c0ce",
  "--muted": "#1a212c",
  "--muted-foreground": "#7f8b9a",
  "--accent": "#192b48",
  "--accent-foreground": "#93c5fd",
  "--destructive": "#f53f3f",
  "--border": "#273241",
  "--input": "#2c3747",
  "--ring": "#3b82f6",
  "--radius": "0.5rem",
} as CSSProperties;

export interface LoginShellProps {
  children: ReactNode;
  /** Header content, usually the host's brand lockup. */
  brand?: ReactNode;
  /** Footer content; the host supplies its own copy and links. */
  footer?: ReactNode;
}

/**
 * Full-page sign-in surface: night background with a radial falloff and the
 * blue accent the account flow expects. The photographic background is
 * intentionally left to the host so each product can ship its own artwork.
 */
export function LoginShell({ children, brand, footer }: LoginShellProps) {
  return (
    <div
      style={NIGHT_THEME}
      className="relative flex min-h-screen flex-col items-center overflow-hidden bg-[#070c17] text-[#e6ecf7]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#070c17_85%)] opacity-70"
      />

      <header className="relative z-10 flex w-full justify-center px-6 pt-10">{brand}</header>

      <main className="relative z-10 flex w-full flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-foreground [&>*]:shadow-2xl [&>*]:shadow-black/40">{children}</div>
      </main>

      {footer ? (
        <footer className="relative z-10 flex w-full flex-col items-center gap-2 px-6 pb-8 text-center">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}
