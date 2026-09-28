"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

/** Always-false on the server, always-true on the client: a hydration-safe
 * "mounted" check without setState-in-effect (which React lint forbids). */
const emptySubscribe = () => () => {};
const useMounted = () => useSyncExternalStore(emptySubscribe, () => true, () => false);

/** Dark-mode switch for the sidebar rail. Renders a placeholder until mounted
 * (next-themes resolves the stored theme client-side; avoids hydration flash). */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return <div className="h-10 w-10" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-none text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      data-testid="theme-toggle"
    >
      {isDark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}
