"use client";

import { DownloadIcon, UploadIcon } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/toast";
import type { ImportResult } from "@/lib/types";

/**
 * Export (JSON/CSV) + import controls for the library.
 * Export downloads via the BFF (attaches the auth cookie server-side);
 * import uploads a JSON/CSV file through the BFF proxy to /library/import.
 */
export function ImportExportToolbar() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  async function handleExport(format: "json" | "csv") {
    try {
      const response = await fetch(`/api/bff/library/export?format=${format}`, {
        method: "GET",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trakplus-library.${format === "json" ? "json" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.add({
        title: "Library exported",
        description: `Downloaded ${format.toUpperCase()}.`,
        type: "success",
      });
    } catch (error) {
      toast.add({
        title: "Export failed",
        description: error instanceof Error ? error.message : "unknown error",
        type: "error",
      });
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/bff/library/import", {
        method: "POST",
        body: formData,
      });
      const result: ImportResult = await response.json();
      if (!response.ok) {
        throw new Error(result.errors?.[0]?.reason ?? "import failed");
      }
      toast.add({
        title: "Import complete",
        description: `${result.created} created, ${result.skipped} skipped, ${result.errors.length} errors.`,
        type: result.errors.length > 0 ? "warning" : "success",
      });
      if (result.errors.length > 0) {
        console.warn("import errors:", result.errors);
      }
    } catch (error) {
      toast.add({
        title: "Import failed",
        description: error instanceof Error ? error.message : "unknown error",
        type: "error",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" data-testid="export-button">
              <DownloadIcon data-icon="inline-start" />
              Export
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => handleExport("json")}>
            Download JSON
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport("csv")}>
            Download CSV
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="outline"
        size="sm"
        disabled={importing}
        onClick={() => fileInputRef.current?.click()}
        data-testid="import-button"
      >
        <UploadIcon data-icon="inline-start" />
        {importing ? "Importing…" : "Import"}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.csv,application/json,text/csv"
        className="hidden"
        data-testid="import-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) handleImportFile(file);
        }}
      />
    </div>
  );
}
