"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { animate } from "animejs";
import {
  CalendarDays,
  ChartColumn,
  Library,
  LogIn,
  LogOut,
  Search,
  Settings,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { queries } from "@/lib/client/api";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const NAV_ITEMS = [
  { href: "/library",  icon: Library,      label: "Library",  match: ["/library", "/directory"] },
  { href: "/search",   icon: Search,       label: "Search",   match: ["/search"] },
  { href: "/schedule", icon: CalendarDays, label: "Schedule", match: ["/schedule"] },
  { href: "/analysis", icon: ChartColumn,  label: "Analysis", match: ["/analysis"] },
  { href: "/settings", icon: Settings,     label: "Settings", match: ["/settings"] },
] as const;

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}

function NavItem({ href, icon: Icon, label, active }: NavItemProps) {
  const iconRef = React.useRef<SVGSVGElement>(null);
  const tooltipRef = React.useRef<HTMLSpanElement>(null);

  const handleMouseEnter = () => {
    if (iconRef.current) {
      animate(iconRef.current, {
        translateY: -2,
        scale: 1.16,
        duration: 240,
        ease: "outBack(2)",
      });
    }
    if (tooltipRef.current) {
      animate(tooltipRef.current, {
        opacity: [0, 1],
        translateX: [4, 0],
        duration: 200,
        ease: "outQuad",
      });
    }
  };

  const handleMouseLeave = () => {
    if (iconRef.current) {
      animate(iconRef.current, {
        translateY: 0,
        scale: 1,
        duration: 300,
        ease: "outElastic(1, 0.6)",
      });
    }
    if (tooltipRef.current) {
      animate(tooltipRef.current, {
        opacity: [1, 0],
        duration: 150,
        ease: "inQuad",
      });
    }
  };

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={`group relative flex h-11 w-full items-center justify-center transition-colors duration-200
        ${active
          ? "text-sidebar-foreground"
          : "text-sidebar-foreground/75 hover:text-sidebar-foreground"
        }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Active left indicator bar */}
      <span
        className="pointer-events-none absolute left-0 top-1/2 w-[3px] bg-sidebar-foreground transition-all duration-300 ease-out"
        style={{
          height: active ? "1.6rem" : "0",
          transform: "translateY(-50%)",
          opacity: active ? 1 : 0,
        }}
      />

      {/* Subtle active / hover backdrop */}
      <span
        className={`pointer-events-none absolute inset-x-2 inset-y-1 transition-all duration-200 ${
          active
            ? "bg-sidebar-foreground/10 shadow-sm"
            : "group-hover:bg-sidebar-foreground/5"
        }`}
      />

      {/* Icon with high contrast and sharp stroke */}
      <Icon
        ref={iconRef as React.Ref<SVGSVGElement>}
        className="relative z-10 size-5"
        strokeWidth={active ? 2.2 : 1.75}
      />

      {/* Floating Tooltip pill on hover */}
      <span
        ref={tooltipRef}
        className="pointer-events-none absolute left-full ml-3.5 z-50 whitespace-nowrap px-2.5 py-1 text-[11px] font-sans font-bold uppercase tracking-[0.12em] bg-foreground text-background shadow-lg opacity-0"
      >
        {label}
      </span>
    </Link>
  );
}

export function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const sidebarRef = React.useRef<HTMLElement>(null);

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: queries.me });

  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
  });

  const initials = (user?.email ?? "?").slice(0, 2).toUpperCase();

  return (
    <aside
      ref={sidebarRef}
      className="fixed left-0 top-0 bottom-0 z-50 flex h-screen w-16 shrink-0 flex-col items-center justify-between border-r py-6 shadow-sm transition-colors duration-200"
      style={{
        background: "var(--sidebar)",
        borderColor: "var(--sidebar-border)",
      }}
    >
      {/* ── Top: Navigation (T logo removed per request) ── */}
      <div className="relative z-10 flex w-full flex-col items-center pt-2">
        <nav
          className="flex w-full flex-col items-center gap-2"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map(({ href, icon, label, match }) => {
            const active = match.some(
              (m) => pathname === m || pathname.startsWith(m + "/"),
            );
            return (
              <NavItem
                key={href}
                href={href}
                icon={icon}
                label={label}
                active={active}
              />
            );
          })}
        </nav>
      </div>

      {/* ── Bottom: Theme Toggle + User Avatar ── */}
      <div className="relative z-10 flex flex-col items-center gap-4">
        <ThemeToggle />

        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Account menu"
              data-testid="user-menu"
              className="flex h-9 w-9 items-center justify-center transition-opacity hover:opacity-80"
            >
              <Avatar className="size-8 border border-sidebar-border">
                <AvatarFallback className="bg-sidebar-foreground/10 font-mono text-[11px] font-bold text-sidebar-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="right"
              sideOffset={12}
              className="min-w-56 p-2 animate-scale-in border border-border bg-popover text-popover-foreground shadow-2xl"
            >
              <div className="px-3 py-2 flex flex-col gap-0.5 border-b border-border/40 pb-2.5 mb-1.5">
                <span className="text-[10px] font-sans font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  Account
                </span>
                <span className="text-xs font-semibold text-foreground break-all leading-snug">
                  {user.email}
                </span>
              </div>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => logout.mutate()}
                  data-testid="logout-button"
                  className="px-3 py-2 text-xs font-medium cursor-pointer"
                >
                  <LogOut className="mr-2 size-3.5 text-muted-foreground" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Link
            href="/login"
            className="flex h-9 w-9 items-center justify-center text-sidebar-foreground/75 transition-colors hover:text-sidebar-foreground"
            title="Log in"
          >
            <LogIn className="size-5" strokeWidth={1.75} />
          </Link>
        )}
      </div>
    </aside>
  );
}
