"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "./ThemeToggle";

export type NavItem = { href: string; label: string };

type Props = {
  items: NavItem[];
};

export function MobileNav({ items }: Props) {
  const [open, setOpen] = React.useState(false);
  const t = useTranslations("header");

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("mobileMenu")} className="lg:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-72 flex-col p-0 sm:w-80">
        <SheetHeader className="border-b border-border px-6 py-4">
          <SheetTitle className="font-display text-base tracking-tight">
            {t("drawerTitle")}
          </SheetTitle>
        </SheetHeader>

        <nav className="flex flex-col gap-1 px-3 py-4">
          {items.map(item => (
            <SheetClose key={item.href} asChild>
              <Link
                href={item.href}
                className="rounded-md px-3 py-3 font-display text-lg tracking-tight text-foreground transition-colors hover:bg-muted hover:text-primary"
              >
                {item.label}
              </Link>
            </SheetClose>
          ))}
        </nav>

        <div className="mt-auto flex flex-col gap-3 border-t border-border px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
              {t("themeLabel")}
            </span>
            <ThemeToggle />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
