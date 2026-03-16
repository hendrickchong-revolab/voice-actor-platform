"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { RecorderLine } from "@/components/RecorderLine";

type NextTaskResult =
  | {
      status: "task";
      script: {
        id: string;
        text: string;
        context: string | null;
        details?: Record<string, string | number | boolean | null | undefined> | null;
      };
    }
  | { status: "done" }
  | { status: "none_available" };

type LoadState =
  | { kind: "loading" }
  | {
      kind: "task";
      script: {
        id: string;
        text: string;
        context: string | null;
        details?: Record<string, string | number | boolean | null | undefined> | null;
      };
    }
  | { kind: "done" }
  | { kind: "none_available" }
  | { kind: "error"; message: string };

function toLoadState(initial: NextTaskResult): LoadState {
  if (initial.status === "task") return { kind: "task", script: initial.script };
  if (initial.status === "done") return { kind: "done" };
  return { kind: "none_available" };
}

export function AgentTaskRunner({
  projectId,
  initial,
}: {
  projectId: string;
  initial: NextTaskResult;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>(() => toLoadState(initial));

  const loadNext = useCallback(async () => {
    setState({ kind: "loading" });

    try {
      const res = await fetch(`/api/agent/next-task?projectId=${encodeURIComponent(projectId)}`, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });

      if (!res.ok) {
        const msg = await res.text();
        setState({ kind: "error", message: msg || "Failed to load next task." });
        return;
      }

      const json = (await res.json()) as NextTaskResult;

      if (json.status === "task") {
        setState({ kind: "task", script: json.script });
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
    window.alert("All tasks in this project are completed.");
    router.push("/agent/tasks");
  }, [router, state.kind]);

  if (state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">Loading task…</p>;
  }

  if (state.kind === "none_available") {
    return (
      <div className="space-y-2">
        <p className="text-sm">No available tasks right now.</p>
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
      scriptId={state.script.id}
      text={state.script.text}
      context={state.script.context}
      details={state.script.details}
      onSubmitted={() => {
        void loadNext();
      }}
    />
  );
}
