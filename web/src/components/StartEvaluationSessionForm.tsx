"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AgentOption = {
  userId: string;
  email: string;
  eligibleCount: number;
};

type ProjectOption = {
  projectId: string;
  projectTitle: string;
};

export function StartEvaluationSessionForm({
  agents,
}: {
  agents: AgentOption[];
}) {
  const router = useRouter();
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [sampleSize, setSampleSize] = useState("10");
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, startLoadingProjects] = useTransition();
  const [creating, startCreating] = useTransition();

  const canChooseProject = selectedAgent.length > 0;
  const canCreate = selectedAgent.length > 0 && selectedProject.length > 0 && !creating;

  async function onAgentChange(agentId: string) {
    setSelectedAgent(agentId);
    setSelectedProject("");
    setProjects([]);

    if (!agentId) return;

    startLoadingProjects(() => {
      void (async () => {
        const res = await fetch(`/api/manager/reviewable-projects?agentId=${encodeURIComponent(agentId)}`, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (!res.ok) {
          router.push(`/manager/review?eval=1&error=${encodeURIComponent("FAILED_TO_LOAD_PROJECTS")}`);
          return;
        }

        const json = (await res.json()) as { projects: ProjectOption[] };
        setProjects(json.projects ?? []);
      })();
    });
  }

  async function onCreateSession() {
    const n = Number.parseInt(sampleSize, 10);
    const safeSample = Number.isFinite(n) ? n : 0;

    startCreating(() => {
      void (async () => {
        const res = await fetch("/api/manager/evaluation-sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            targetUserId: selectedAgent,
            projectId: selectedProject,
            sampleSize: safeSample,
          }),
        });

        if (!res.ok) {
          const json = (await res.json().catch(() => ({ error: "UNKNOWN" }))) as { error?: string };
          router.push(`/manager/review?eval=1&error=${encodeURIComponent(json.error ?? "UNKNOWN")}`);
          return;
        }

        const json = (await res.json()) as { sessionId: string };
        router.push(`/manager/review?session=${encodeURIComponent(json.sessionId)}&created=1`);
      })();
    });
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-1">
        <label className="text-sm font-medium" htmlFor="eval_agent">
          Agent
        </label>
        <select
          id="eval_agent"
          name="eval_agent"
          value={selectedAgent}
          onChange={(e) => {
            void onAgentChange(e.currentTarget.value);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Select an agent</option>
          {agents.map((a) => (
            <option key={a.userId} value={a.userId}>
              {a.email} ({a.eligibleCount} total eligible)
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium" htmlFor="eval_project">
          Project
        </label>
        <select
          id="eval_project"
          name="eval_project"
          value={selectedProject}
          onChange={(e) => setSelectedProject(e.currentTarget.value)}
          disabled={!canChooseProject || loadingProjects || projects.length === 0}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">{loadingProjects ? "Loading projects..." : "Select a project"}</option>
          {projects.map((p) => (
            <option key={p.projectId} value={p.projectId}>
              {p.projectTitle}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-1">
        <label className="text-sm font-medium" htmlFor="eval_sampleSize">
          Sample size
        </label>
        <Input
          id="eval_sampleSize"
          name="eval_sampleSize"
          type="number"
          min={1}
          max={50}
          value={sampleSize}
          onChange={(e) => setSampleSize(e.currentTarget.value)}
          disabled={!selectedProject}
        />
        <p className="text-xs text-muted-foreground">Maximum 50 recordings per session.</p>
      </div>

      <div className="flex items-center justify-end">
        <Button type="button" variant="secondary" disabled={!canCreate} onClick={() => void onCreateSession()}>
          {creating ? "Creating..." : "Create Session"}
        </Button>
      </div>
    </div>
  );
}
