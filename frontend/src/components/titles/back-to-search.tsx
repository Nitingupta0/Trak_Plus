"use client";

import { useRouter } from "next/navigation";

export function BackToSearch() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="text-muted-foreground text-sm underline"
      onClick={() => {
        if (window.history.length > 1) window.history.back();
        else router.push("/search");
      }}
    >
      ← Back to search
    </button>
  );
}
