import React from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AmbientBackground } from "@/components/layout/ambient-background";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      {/* Living ambient background with motion orbs, grid texture, and spotlight */}
      <AmbientBackground />

      {/* Fixed sidebar — stays pinned to viewport on all scroll events */}
      <AppSidebar />

      {/* Main content pane with left padding to offset the 64px fixed sidebar */}
      <div
        className="relative z-10 min-h-screen pl-16 transition-all"
        data-slot="content"
      >
        {children}
      </div>
    </div>
  );
}
