"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type AssignableAgent = {
  id: string;
  email: string;
  name: string | null;
  languages?: string[];
};

function normalize(s: string) {
  return s.trim().toLowerCase();
}

function matchesSearch(a: AssignableAgent, q: string) {
  const query = normalize(q);
  if (!query) return true;
  const langs = a.languages ?? [];
  const hay = `${a.email} ${a.name ?? ""} ${langs.join(" ")}`.toLowerCase();
  return hay.includes(query);
}

function matchesLanguage(a: AssignableAgent, projectLanguage: string) {
  const lang = normalize(projectLanguage);
  if (!lang) return true;
  const langs = a.languages ?? [];
  return langs.some((l) => normalize(l) === lang);
}

export function ProjectAssignmentsPicker({
  agents,
  initialAssignedIds,
  projectLanguage,
}: {
  agents: AssignableAgent[];
  initialAssignedIds: string[];
  projectLanguage?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [assignedIds, setAssignedIds] = useState<string[]>(() => initialAssignedIds);

  const assignedSet = useMemo(() => new Set(assignedIds), [assignedIds]);

  const { assignedAgents, unassignedAgents } = useMemo(() => {
    const assigned: AssignableAgent[] = [];
    const unassigned: AssignableAgent[] = [];
    for (const a of agents) {
      if (assignedSet.has(a.id)) assigned.push(a);
      else unassigned.push(a);
    }
    return { assignedAgents: assigned, unassignedAgents: unassigned };
  }, [agents, assignedSet]);

  const effectiveProjectLanguage = (projectLanguage ?? "").trim();
  const isLanguageScoped = effectiveProjectLanguage.length > 0;

  const filteredUnassigned = useMemo(() => {
    return unassignedAgents
      .filter((a) => matchesSearch(a, query))
      .filter((a) => (isLanguageScoped && !showOther ? matchesLanguage(a, effectiveProjectLanguage) : true))
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  }, [effectiveProjectLanguage, isLanguageScoped, query, showOther, unassignedAgents]);

  const filteredAssigned = useMemo(() => {
    // Always show assigned, but still apply search to keep it usable at scale.
    return assignedAgents
      .filter((a) => matchesSearch(a, query))
      .sort((a, b) => (a.name ?? a.email).localeCompare(b.name ?? b.email));
  }, [assignedAgents, query]);

  function assign(id: string) {
    setAssignedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  }

  function unassign(id: string) {
    setAssignedIds((prev) => prev.filter((x) => x !== id));
  }

  function assignAllFiltered() {
    setAssignedIds((prev) => {
      const next = new Set(prev);
      for (const a of filteredUnassigned) next.add(a.id);
      return Array.from(next);
    });
  }

  function unassignAllVisible() {
    setAssignedIds((prev) => {
      const remove = new Set(filteredAssigned.map((a) => a.id));
      return prev.filter((id) => !remove.has(id));
    });
  }

  return (
    <div className="space-y-4">
      {/* Hidden inputs for server action */}
      {assignedIds.map((id) => (
        <input key={id} type="hidden" name="agentIds" value={id} />
      ))}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <label className="text-sm font-medium" htmlFor="agent_search">
            Search agents
          </label>
          <Input
            id="agent_search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, email, or language…"
          />
        </div>

        <div className="flex items-end">
          <label className={cn("flex items-center gap-2 text-sm", !isLanguageScoped && "opacity-50")}>
            <input
              type="checkbox"
              checked={!isLanguageScoped ? true : showOther}
              disabled={!isLanguageScoped}
              onChange={(e) => setShowOther(e.target.checked)}
            />
            Show other voice actors
          </label>
        </div>
      </div>

      {isLanguageScoped ? (
        <p className="text-xs text-muted-foreground">
          Project language is <span className="font-medium">{effectiveProjectLanguage}</span>. Unassigned list is filtered to
          matching agents unless “Show other voice actors” is enabled.
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          No project language set — showing all agents.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              Unassigned <span className="text-muted-foreground">({filteredUnassigned.length})</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={assignAllFiltered} disabled={filteredUnassigned.length === 0}>
              Assign all shown
            </Button>
          </div>

          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {filteredUnassigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching unassigned agents.</p>
            ) : (
              filteredUnassigned.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name ?? a.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                    {(a.languages ?? []).length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(a.languages ?? []).map((lang) => (
                          <Badge key={`${a.id}_${lang}`} variant="secondary" className="text-[11px]">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Button type="button" size="sm" onClick={() => assign(a.id)}>
                    Assign
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="text-sm font-medium">
              Assigned <span className="text-muted-foreground">({filteredAssigned.length})</span>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={unassignAllVisible} disabled={filteredAssigned.length === 0}>
              Unassign all shown
            </Button>
          </div>

          <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
            {filteredAssigned.length === 0 ? (
              <p className="text-sm text-muted-foreground">No assigned agents match the current search.</p>
            ) : (
              filteredAssigned.map((a) => (
                <div key={a.id} className="flex items-start justify-between gap-3 rounded-md border p-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{a.name ?? a.email}</div>
                    <div className="truncate text-xs text-muted-foreground">{a.email}</div>
                    {(a.languages ?? []).length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(a.languages ?? []).map((lang) => (
                          <Badge key={`${a.id}_${lang}`} variant="secondary" className="text-[11px]">
                            {lang}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => unassign(a.id)}>
                    Unassign
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


