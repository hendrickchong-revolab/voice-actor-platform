"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export function ExportProjectButton({ projectId }: { projectId: string }) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [format, setFormat] = useState<"csv" | "json">("csv");

  function open() {
    dialogRef.current?.showModal();
  }

  function close() {
    dialogRef.current?.close();
  }

  function exportNow() {
    close();
    const url = `/api/projects/${encodeURIComponent(projectId)}/export?format=${encodeURIComponent(format)}`;
    window.location.href = url;
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={open}>
        Export
      </Button>

      <dialog ref={dialogRef} className="rounded-md border bg-background p-0">
        <div className="p-4">
          <div className="text-base font-semibold">Export project</div>
          <div className="mt-1 text-sm text-muted-foreground">
            Choose a metadata format. Export uploads approved (and/or auto-passed) audios to the configured destination S3 bucket.
          </div>

          <div className="mt-4 space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                value="csv"
                checked={format === "csv"}
                onChange={() => setFormat("csv")}
              />
              CSV
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="format"
                value="json"
                checked={format === "json"}
                onChange={() => setFormat("json")}
              />
              JSON
            </label>
          </div>

          <div className="mt-4 flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="button" onClick={exportNow}>
              Export
            </Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
