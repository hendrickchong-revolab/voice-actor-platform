"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [retryCountdown, setRetryCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Auto-retry with countdown when no tasks are available (another user may have a lock expiring).
  useEffect(() => {
    if (state.kind !== "none_available") {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      setRetryCountdown(0);
      return;
    }

    const RETRY_SECONDS = 30;
    setRetryCountdown(RETRY_SECONDS);
    countdownRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          void loadNext();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [state.kind, loadNext]);

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
        <p className="text-sm text-muted-foreground">
          Another user may have a task locked. Retrying in{" "}
          <span className="tabular-nums font-medium">{retryCountdown}s</span>…
        </p>
        <button
          className="underline text-sm"
          type="button"
          onClick={() => {
            void loadNext();
          }}
        >
          Refresh now
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
