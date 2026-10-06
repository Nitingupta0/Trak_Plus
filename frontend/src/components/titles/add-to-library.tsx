"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { StatusSelector } from "@/components/library/status-selector";
import { bff, queries } from "@/lib/client/api";
import {
  STATUS_LABELS,
  type LibraryEntry,
  type LibraryStatus,
  type MediaType,
} from "@/lib/types";

/** Statuses relevant per media type (product language: Watching/Playing/Reading). */
function statusesFor(mediaType: MediaType): LibraryStatus[] {
  switch (mediaType) {
    case "movie":
    case "tv":
      return ["watching", "plan_to", "completed", "dropped", "on_hold"];
    case "game":
      return ["playing", "plan_to", "completed", "dropped", "on_hold"];
    case "anime":
      return ["watching", "plan_to", "completed", "dropped", "on_hold"];
    case "manga":
      return ["reading", "plan_to", "completed", "dropped", "on_hold"];
  }
}

interface AddToLibraryProps {
  internalTitleId: string | null;
  mediaType: MediaType;
  fallbackLabel: string;
}

export function AddToLibrary({ internalTitleId, mediaType, fallbackLabel }: AddToLibraryProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LibraryStatus>(statusesFor(mediaType)[0]);
  const [rating, setRating] = useState("");
  const [isEditingRating, setIsEditingRating] = useState(false);
  // Track the entry id once added, so a rating can PATCH the right entry even
  // before the library query refetches (avoids a double-POST 409 race).
  const entryIdRef = useRef<string | null>(null);

  const { data: library } = useQuery({
    queryKey: ["library"],
    queryFn: queries.library,
    retry: false,
  });

  const existingEntry: LibraryEntry | undefined = internalTitleId
    ? library?.find((entry) => entry.title.id === internalTitleId)
    : undefined;

  // Before the user acts, show the item's current saved status; once they click
  // another status, reflect that selection immediately (and it auto-saves).
  const displayStatus = existingEntry ? existingEntry.status : status;

  // The persisted rating comes straight from the server (no setState-in-effect).
  // While the user is mid-edit, show their local input instead.
  const savedRating = existingEntry?.rating != null ? String(existingEntry.rating) : "";
  const displayRating = isEditingRating ? rating : savedRating;

  const upsert = useMutation({
    mutationFn: async (patch: { status?: LibraryStatus; rating?: number }) => {
      if (!internalTitleId) throw new Error("title not cached yet");
      if (entryIdRef.current) {
        const body: { status?: LibraryStatus; rating?: number } = {};
        if (patch.status !== undefined) body.status = patch.status;
        if (patch.rating !== undefined) body.rating = patch.rating;
        return bff<LibraryEntry>(`/library/${entryIdRef.current}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return bff<LibraryEntry>("/library", {
        method: "POST",
        body: JSON.stringify({
          title_id: internalTitleId,
          status: patch.status ?? statusesFor(mediaType)[0],
          ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
        }),
      });
    },
    onSuccess: (entry) => {
      const wasAdding = !entryIdRef.current;
      entryIdRef.current = entry.id;
      setIsEditingRating(false);
      setRating(entry.rating != null ? String(entry.rating) : "");
      queryClient.invalidateQueries({ queryKey: ["library"] });
      setStatus(entry.status);
      toast.add({
        title: wasAdding ? "Added to library" : "Library updated",
        description: `${fallbackLabel} — ${STATUS_LABELS[entry.status]}`,
        type: "success",
      });
    },
    onError: (error: Error) => {
      if (error.message === "not authenticated") return;
      toast.add({ title: "Could not update library", description: error.message, type: "error" });
    },
  });

  // Persist the rating once the user stops typing (debounced) or on blur.
  const commitRating = () => {
    if (rating === "") return;
    const parsed = Number(rating);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 10) return;
    upsert.mutate({ rating: parsed });
  };

  // Debounce rating input so it saves shortly after typing stops.
  useEffect(() => {
    if (rating === "") return;
    const t = setTimeout(() => commitRating(), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rating]);

  if (!internalTitleId) return null;

  return (
    <FieldGroup className="max-w-md">
      <Field>
        <FieldLabel htmlFor="status-selector">
          {existingEntry ? "Change status" : "Add to library"}
        </FieldLabel>
        <StatusSelector
          value={displayStatus}
          options={statusesFor(mediaType)}
          onChange={(next) => {
            setStatus(next);
            upsert.mutate({ status: next });
          }}
          testId="status-selector"
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="rating">Rating (1–10, optional)</FieldLabel>
        <input
          id="rating"
          type="number"
          min={1}
          max={10}
          value={displayRating}
          onChange={(event) => {
            setRating(event.target.value);
            setIsEditingRating(true);
          }}
          onBlur={commitRating}
          placeholder="—"
          className="border-input bg-background w-24 rounded-none border px-3 py-2 text-sm outline-none"
        />
        <p className="text-[10px] text-muted-foreground/70">
          Rating saves automatically.
        </p>
      </Field>
    </FieldGroup>
  );
}
