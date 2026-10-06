"use client";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group";
import { STATUS_LABELS, type LibraryStatus } from "@/lib/types";

interface StatusSelectorProps {
  value: LibraryStatus;
  options: LibraryStatus[];
  onChange: (status: LibraryStatus) => void;
  disabled?: boolean;
  testId?: string;
}

/** Toggle group of library statuses (product language: Watching/Playing/Reading…). */
export function StatusSelector({
  value,
  options,
  onChange,
  disabled = false,
  testId,
}: StatusSelectorProps) {
  return (
    <ToggleGroup
      value={[value]}
      onValueChange={(groupValue: string[]) => {
        if (groupValue.length > 0) onChange(groupValue[0] as LibraryStatus);
      }}
      variant="outline"
      className="flex-wrap"
      data-testid={testId}
      {...(disabled ? { "aria-disabled": true } : {})}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option} value={option}>
          {STATUS_LABELS[option]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
