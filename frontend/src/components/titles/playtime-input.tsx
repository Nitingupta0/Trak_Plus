"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Pencil, Check, X } from "lucide-react";
import { bff } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import type { LibraryEntry } from "@/lib/types";

interface PlaytimeInputProps {
  entry: LibraryEntry;
}

/** Format minutes into readable format (e.g., "24h 30m", "45m") */
function formatPlaytime(minutes: number | null): string {
  if (minutes == null || minutes === 0) return "Not tracked";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Playtime input component for games.
 * Shows current playtime with edit capability.
 */
export function PlaytimeInput({ entry }: PlaytimeInputProps) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [hours, setHours] = useState(Math.floor((entry.playtime_minutes ?? 0) / 60));
  const [minutes, setMinutes] = useState((entry.playtime_minutes ?? 0) % 60);

  const updatePlaytime = useMutation({
    mutationFn: async (totalMinutes: number) => {
      const result = await bff<LibraryEntry>(`/library/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ playtime_minutes: totalMinutes }),
      });
      return result;
    },
    onSuccess: (updatedEntry) => {
      // Update the cache with the updated entry
      queryClient.setQueryData(["library"], (old: LibraryEntry[] | undefined) =>
        old?.map((e) => (e.id === entry.id ? { ...e, playtime_minutes: updatedEntry.playtime_minutes } : e)),
      );
      // Invalidate to ensure fresh data on next fetch
      queryClient.invalidateQueries({ queryKey: ["library"] });
      setIsEditing(false);
      toast.add({ title: "Playtime updated", type: "success" });
    },
    onError: (error: Error) => {
      toast.add({ title: "Update failed", description: error.message, type: "error" });
    },
  });

  const handleSave = () => {
    const totalMinutes = hours * 60 + minutes;
    updatePlaytime.mutate(totalMinutes);
  };

  const handleCancel = () => {
    setHours(Math.floor((entry.playtime_minutes ?? 0) / 60));
    setMinutes((entry.playtime_minutes ?? 0) % 60);
    setIsEditing(false);
  };

  const handleStartEdit = () => {
    setHours(Math.floor((entry.playtime_minutes ?? 0) / 60));
    setMinutes((entry.playtime_minutes ?? 0) % 60);
    setIsEditing(true);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-3 border border-border/40 bg-muted/20">
        <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
          Playtime
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              value={hours}
              onChange={(e) => setHours(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 bg-popover border border-border/60 px-2 py-1 text-sm font-mono text-foreground outline-none focus:border-foreground/60"
              placeholder="0"
            />
            <span className="text-xs text-muted-foreground">h</span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={59}
              value={minutes}
              onChange={(e) => setMinutes(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
              className="w-16 bg-popover border border-border/60 px-2 py-1 text-sm font-mono text-foreground outline-none focus:border-foreground/60"
              placeholder="0"
            />
            <span className="text-xs text-muted-foreground">m</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={updatePlaytime.isPending}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider bg-green-500/10 text-green-600 border border-green-500/30 hover:bg-green-500/20 transition-colors"
          >
            <Check className="w-3 h-3" />
            Save
          </button>
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground border border-border/40 hover:border-border/60 transition-colors"
          >
            <X className="w-3 h-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      className="flex items-center gap-2 p-3 border border-border/30 bg-card/30 hover:bg-card/50 hover:border-border/50 transition-all group"
    >
      <Clock className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
      <div className="flex-1 text-left">
        <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
          Playtime
        </span>
        <span className="block text-sm font-mono font-bold text-foreground">
          {formatPlaytime(entry.playtime_minutes ?? null)}
        </span>
      </div>
      <Pencil className="w-3 h-3 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
    </button>
  );
}
