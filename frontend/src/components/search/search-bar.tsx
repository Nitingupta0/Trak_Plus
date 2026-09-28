"use client";

import { Loader2Icon, SearchIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onQueryChange: (query: string) => void;
  onValueChange?: (value: string) => void;
  value?: string;
  placeholder?: string;
  debounceMs?: number;
  disabled?: boolean;
}

/** Debounced single search bar — the one bar across every media type. */
export function SearchBar({
  onQueryChange,
  onValueChange,
  value: controlledValue,
  placeholder = "Search movies, TV, games, anime, manga…",
  debounceMs = 300,
  disabled = false,
}: SearchBarProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState("");
  const [pending, setPending] = useState(false);
  const value = controlledValue ?? uncontrolledValue;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleChange(next: string) {
    if (controlledValue === undefined) setUncontrolledValue(next);
    onValueChange?.(next);
    if (disabled) return;
    setPending(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      onQueryChange(next.trim());
      setPending(false);
    }, debounceMs);
  }

  return (
    <div className="relative w-full" data-testid="search-bar">
      <SearchIcon className="text-muted-foreground pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2" />
      <Input
        className="pl-9"
        value={value}
        disabled={disabled}
        aria-label="Search titles"
        placeholder={placeholder}
        onChange={(event) => handleChange(event.target.value)}
      />
      {pending ? (
        <Loader2Icon className="animate-spin text-muted-foreground absolute right-3 top-1/2 size-4 -translate-y-1/2" />
      ) : null}
    </div>
  );
}
