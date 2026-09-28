"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { bff, queries } from "@/lib/client/api";
import type { LibraryEntry } from "@/lib/types";

interface NotesRailProps {
  internalTitleId: string | null;
}

/**
 * Right-hand notes rail on the title detail page. Loads the user's library
 * entry for this title (if any) and lets them edit the personal note via PATCH
 * /library/{id} — the same bff path the library page uses for status/rating.
 */
export function NotesRail({ internalTitleId }: NotesRailProps) {
  const queryClient = useQueryClient();
  const { data: library } = useQuery({
    queryKey: ["library"],
    queryFn: queries.library,
    retry: false,
  });

  const entry: LibraryEntry | undefined = internalTitleId
    ? library?.find((candidate) => candidate.title.id === internalTitleId)
    : undefined;

  const [draft, setDraft] = useState("");
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!touched) {
      // The library query resolves after the first render; hydrate the editor
      // from that external query result without overwriting active edits.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDraft(entry?.notes ?? "");
    }
  }, [entry?.id, entry?.notes, touched]);

  const save = useMutation({
    mutationFn: (notes: string) =>
      bff<LibraryEntry>(`/library/${entry!.id}`, {
        method: "PATCH",
        body: JSON.stringify({ notes: notes.trim() || null }),
      }),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
      setDraft(updated.notes ?? "");
      setTouched(false);
      toast.add({ title: "Note saved", type: "success" });
    },
    onError: (error: Error) => {
      if (error.message === "not authenticated") return;
      toast.add({ title: "Could not save note", description: error.message, type: "error" });
    },
  });

  if (!internalTitleId) return null;

  return (
    <aside aria-label="Personal notes" className="flex flex-col gap-3">
      <h2 className="text-muted-foreground font-mono text-xs font-medium uppercase tracking-widest">
        Notes
      </h2>
      {!entry ? (
        <p className="text-muted-foreground text-sm">
          Add this title to your library to leave personal notes.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <textarea
            aria-label="Personal notes"
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value);
              setTouched(true);
            }}
            rows={6}
            placeholder="Your thoughts, observations, what to revisit…"
            className="border-input bg-background w-full resize-y rounded-none border px-3 py-2 text-sm outline-none focus-visible:border-ring"
            data-testid="notes-textarea"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setDraft(entry.notes ?? "");
                setTouched(false);
              }}
              disabled={!touched || save.isPending}
              className="rounded-none font-mono text-xs uppercase tracking-widest"
            >
              Discard
            </Button>
            <Button
              size="sm"
              onClick={() => save.mutate(draft)}
              disabled={!touched || save.isPending}
              className="rounded-none font-mono text-xs uppercase tracking-widest"
              data-testid="notes-save"
            >
              {save.isPending ? "Saving…" : "Save note"}
            </Button>
          </div>
        </div>
      )}
    </aside>
  );
}
