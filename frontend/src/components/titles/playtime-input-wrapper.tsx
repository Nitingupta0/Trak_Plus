"use client";

import { useQuery } from "@tanstack/react-query";
import { queries } from "@/lib/client/api";
import type { LibraryEntry } from "@/lib/types";
import { PlaytimeInput } from "./playtime-input";

/** Client wrapper to fetch library entry for playtime input */
export function PlaytimeInputWrapper({ internalTitleId }: { internalTitleId: string }) {
  const { data: library } = useQuery({
    queryKey: ["library"],
    queryFn: queries.library,
    retry: false,
  });
  const entry = library?.find((e: LibraryEntry) => e.title.id === internalTitleId);

  if (!entry) return null;
  return <PlaytimeInput entry={entry} />;
}
