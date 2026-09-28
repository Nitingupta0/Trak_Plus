import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in — TrakPlus",
};

export default function LoginPage() {
  return (
    <main className="h-screen relative overflow-hidden bg-background">
      {/* Warm aurora orbs (mirrors app body) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-[-8rem] right-[-6rem] w-[36rem] h-[36rem] rounded-full bg-[oklch(0.870_0.025_80/0.18)] blur-[60px]" />
        <div className="absolute bottom-[-10rem] left-2 w-[28rem] h-[28rem] rounded-full bg-[oklch(0.860_0.022_92/0.15)] blur-[50px]" />
      </div>

      <div className="relative grid h-full lg:grid-cols-2">
        {/* ── Left — Form ── */}
        <div className="flex flex-col justify-center px-8 lg:px-16">
          <div className="w-full max-w-md mx-auto">
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-10">
              <span className="font-serif text-3xl font-bold tracking-tight text-foreground">
                TrakPlus
              </span>
              <span className="size-2 rounded-full bg-[--status-active]" aria-hidden="true" />
            </div>

            {/* Form (includes heading, toggle, google, fields, CTA, footer) */}
            <LoginForm />
          </div>
        </div>

        {/* ── Right — Archive Illustration ── */}
        <div className="hidden lg:flex flex-col justify-between relative border-l border-border/40 bg-[oklch(0.912_0.016_86)] overflow-hidden h-full">
          {/* Grain overlay */}
          <div className="pointer-events-none absolute inset-0 grain-overlay" />

          {/* Illustration fills the panel */}
          <div className="relative z-10 flex-1 flex items-center justify-center w-full px-6 animate-fade-up">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/login-illustration.png"
              alt="Movies, games, manga, anime, and TV illustrated"
              className="w-full max-w-3xl h-auto object-contain"
            />
          </div>

          {/* Tagline + media badges — pinned to the bottom */}
          <div className="relative z-10 pb-8 px-10 flex flex-col gap-3 items-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground/70">
              Your personal media archive
            </p>

            <div className="flex flex-wrap items-center gap-2.5">
              {[
                { icon: "game", label: "Games" },
                { icon: "movie", label: "Movies" },
                { icon: "manga", label: "Manga" },
                { icon: "anime", label: "Anime" },
                { icon: "tv", label: "TV" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-border/60 bg-[oklch(0.945_0.012_90.2)] text-foreground/80"
                >
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    {item.icon === "game" ? (
                      <>
                        <line x1="6" y1="10" x2="6" y2="14" />
                        <line x1="4" y1="12" x2="8" y2="12" />
                        <line x1="16" y1="11" x2="16" y2="11" />
                        <line x1="18" y1="13" x2="18" y2="13" />
                        <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
                      </>
                    ) : item.icon === "movie" ? (
                      <>
                        <rect x="2" y="4" width="20" height="16" rx="2" />
                        <path d="M2 8h20M2 16h20M8 4v16" />
                      </>
                    ) : item.icon === "manga" ? (
                      <>
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </>
                    ) : item.icon === "anime" ? (
                      <>
                        <circle cx="12" cy="12" r="9" />
                        <path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z" />
                      </>
                    ) : (
                      <>
                        <rect x="2" y="6" width="20" height="12" rx="2" />
                        <path d="M8 6v12" />
                      </>
                    )}
                  </svg>
                  <span className="font-mono text-[10px] uppercase tracking-wider">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
