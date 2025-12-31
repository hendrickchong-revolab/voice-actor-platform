"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function ExportProjectButton({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [isExporting, setIsExporting] = useState(false);

  async function exportNow() {
    setIsExporting(true);
    try {
      const url = `/api/projects/${encodeURIComponent(projectId)}/export?format=${encodeURIComponent(format)}`;
      window.location.href = url;
      // Close dialog after a brief delay to show loading state
      setTimeout(() => {
        setOpen(false);
        setIsExporting(false);
      }, 300);
    } catch (error) {
      console.error("Export failed:", error);
      setIsExporting(false);
    }
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Export Project
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Export Project</DialogTitle>
            <DialogDescription>
              Export project tasks and recordings. The export includes all tasks (ScriptLines) and approved/auto-passed recordings. 
              Audio files will be copied to the configured export S3 bucket when available.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3">
              <label className="text-sm font-medium">Export Format</label>
              <div className="grid gap-3">
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-4 cursor-pointer transition-colors",
                    format === "csv"
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="format"
                    value="csv"
                    checked={format === "csv"}
                    onChange={() => setFormat("csv")}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">CSV</div>
                    <div className="text-sm text-muted-foreground">
                      Comma-separated values, ideal for spreadsheet analysis
                    </div>
                  </div>
                </label>
                <label
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-4 cursor-pointer transition-colors",
                    format === "json"
                      ? "border-primary bg-primary/5"
                      : "border-input hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name="format"
                    value="json"
                    checked={format === "json"}
                    onChange={() => setFormat("json")}
                    className="h-4 w-4 text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">JSON</div>
                    <div className="text-sm text-muted-foreground">
                      JavaScript Object Notation, preserves data structure
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isExporting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={exportNow} disabled={isExporting}>
              {isExporting ? "Exporting..." : "Export"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
