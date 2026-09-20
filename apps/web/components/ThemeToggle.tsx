"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

export type Theme = "light" | "dark";

function applyTheme(next: Theme) {
  document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.classList.toggle("dark", next === "dark");
}

/**
 * Light/dark toggle. The default (no explicit choice) follows the OS preference
 * via the inline THEME_SCRIPT in the layout, which sets the `.dark` class before
 * paint. The icon is purely CSS-driven off that class (Tailwind `dark:` variant),
 * so it always matches the resolved theme with no React state and no hydration
 * mismatch; clicking reads the current class and flips it.
 */
export function ThemeToggle() {
  const toggle = () => {
    const next: Theme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  };

  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" title="Toggle theme" onClick={toggle}>
      <Sun className="size-4 dark:hidden" />
      <Moon className="hidden size-4 dark:block" />
    </Button>
  );
}
