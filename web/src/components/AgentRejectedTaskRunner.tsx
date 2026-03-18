"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { RecorderLine } from "@/components/RecorderLine";

type NextRejectedTaskResult =
  | {
      status: "task";
      item: {
        script: {
          id: string;
          text: string;
          context: string | null;
          details?: Record<string, string | number | boolean | null | undefined> | null;
        };
        rejectedRecordingId: string;
      };
    }
  | { status: "done" }
  | { status: "none_available" };

type LoadState =
  | { kind: "loading" }
  | {
      kind: "task";
      item: {
        script: {
          id: string;
          text: string;
          context: string | null;
          details?: Record<string, string | number | boolean | null | undefined> | null;
        };
        rejectedRecordingId: string;
      };
    }
  | { kind: "done" }
  | { kind: "none_available" }
  | { kind: "error"; message: string };

function toLoadState(initial: NextRejectedTaskResult): LoadState {
  if (initial.status === "task") return { kind: "task", item: initial.item };
  if (initial.status === "done") return { kind: "done" };
  return { kind: "none_available" };
}

export function AgentRejectedTaskRunner({
  projectId,
  initial,
}: {
  projectId: string;
  initial: NextRejectedTaskResult;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>(() => toLoadState(initial));

  const loadNext = useCallback(async () => {
    setState({ kind: "loading" });

    try {
      const res = await fetch(`/api/agent/next-rejected-task?projectId=${encodeURIComponent(projectId)}`, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const msg = await res.text();
        setState({ kind: "error", message: msg || "Failed to load rejected task." });
        return;
      }

      const json = (await res.json()) as NextRejectedTaskResult;

      if (json.status === "task") {
        setState({ kind: "task", item: json.item });
      } else if (json.status === "done") {
        setState({ kind: "done" });
      } else {
        setState({ kind: "none_available" });
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState({ kind: "error", message });
    }
  }, [projectId]);

  useEffect(() => {
    if (state.kind !== "done") return;
    window.alert("All rejected tasks for this project are resolved.");
    router.push("/agent/rejected-tasks");
  }, [router, state.kind]);

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">Loading rejected task…</p>;
  }

  if (state.kind === "none_available") {
    return (
      <div className="space-y-2">
        <p className="text-sm">No rejected tasks available right now.</p>
        <p className="text-sm text-muted-foreground">Try again in a moment.</p>
        <button
          className="underline text-sm"
          type="button"
          onClick={() => {
            void loadNext();
          }}
        >
          Refresh
        </button>
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{state.message}</p>
        <button
          className="underline text-sm"
          type="button"
          onClick={() => {
            void loadNext();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.kind === "done") {
    return <p className="text-sm">Done.</p>;
  }

  return (
    <RecorderLine
      scriptId={state.item.script.id}
      text={state.item.script.text}
      context={state.item.script.context}
      details={state.item.script.details}
      previousRecordingId={state.item.rejectedRecordingId}
      submitMode="rejected-review"
      onSubmitted={() => {
        void loadNext();
      }}
    />
  );
}
