"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";

import { AppLayout } from "@/components/layout/app-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeInStagger } from "@/components/ui/fade-in-stagger";
import { queries } from "@/lib/client/api";

/** Settings — identity, data export/import, account actions. */
export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user, isPending, isError, error } = useQuery({
    queryKey: ["me"],
    queryFn: queries.me,
    retry: false,
  });

  useEffect(() => {
    if (isError && error.message === "not authenticated") {
      router.replace("/login");
    }
  }, [isError, error, router]);

  const logout = useMutation({
    mutationFn: () => fetch("/api/auth/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
  });

  const exportUrl = (format: string) => `/api/bff/library/export?format=${format}`;

  return (
    <AppLayout>
      <main className="page-gutter flex flex-col gap-6 max-w-3xl" data-testid="settings-page">
        <header className="pb-6 hairline-b">
          <h1 className="font-serif text-2xl font-bold tracking-tight">Settings</h1>
        </header>

        {isPending ? (
          <Skeleton className="h-32 w-full rounded-none" />
        ) : user ? (
          <FadeInStagger className="flex flex-col gap-6">
            <section aria-label="Account" className="flex flex-col gap-2">
              <h2 className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.08em] uppercase">
                Account
              </h2>
              <div className="flex items-center justify-between gap-4 border-b border-border/50 py-3">
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{user.email}</span>
                  <span className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
                    Member since {new Date(user.created_at).toLocaleDateString()}
                  </span>
                </div>
                <Badge variant="outline" className="rounded-none font-mono text-xs uppercase">
                  signed in
                </Badge>
              </div>
            </section>

            <Separator />

            <section aria-label="Data" className="flex flex-col gap-2">
              <h2 className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.08em] uppercase">
                Your data
              </h2>
              <p className="text-muted-foreground text-sm">
                Export your library as Trakt-compatible JSON or CSV. Import lives on the{" "}
                <Link href="/library" className="underline hover:text-foreground">
                  library page
                </Link>
                .
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(exportUrl("json"), "_blank")}
                  data-testid="export-json"
                >
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(exportUrl("csv"), "_blank")}
                  data-testid="export-csv"
                >
                  Export CSV
                </Button>
              </div>
            </section>

            <Separator />

            <section aria-label="Appearance" className="flex flex-col gap-2">
              <h2 className="text-muted-foreground font-sans text-[11px] font-semibold tracking-[0.08em] uppercase">
                Appearance
              </h2>
              <p className="text-muted-foreground text-sm">
                Light/dark switch lives in the sidebar rail (sun/moon icon).
              </p>
            </section>

            <Separator />

            <section aria-label="Danger zone" className="flex flex-col gap-2">
              <h2 className="text-destructive font-sans text-[11px] font-semibold tracking-[0.08em] uppercase">
                Danger Zone
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="w-fit rounded-none font-mono text-xs uppercase tracking-widest mt-2 border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                onClick={() => logout.mutate()}
                data-testid="settings-logout"
              >
                Log out
              </Button>
            </section>
          </FadeInStagger>
        ) : null}
      </main>
    </AppLayout>
  );
}
