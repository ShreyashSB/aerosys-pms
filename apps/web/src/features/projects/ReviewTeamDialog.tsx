import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { StarRating } from "@/components/common/StarRating";
import { useCurrentUser } from "@/auth/AuthContext";
import { useAppData, type AppData } from "@/hooks/useAppData";
import { useSaveProjectReviews } from "@/hooks/mutations";
import { formatNumber } from "@/lib/format";
import type { EngineerReview, Project } from "@/types/models";

type Draft = { rating: number; comments: string };

/** Everyone who logged time on the project or was assigned to it, except its manager. */
export function projectTeam(project: Project, data: Pick<AppData, "perf" | "assignments" | "employeeById" | "reviews">) {
  const usage = data.perf.get(project.id)?.byEmployee ?? [];
  const ids = new Set([...usage.map((u) => u.employeeId), ...data.assignments.filter((a) => a.projectId === project.id).map((a) => a.employeeId)]);
  ids.delete(project.managerId);
  return [...ids]
    .map((id) => ({
      employee: data.employeeById.get(id)!,
      usage: usage.find((u) => u.employeeId === id),
      role: data.assignments.find((a) => a.projectId === project.id && a.employeeId === id)?.role,
      review: data.reviews.find((r) => r.projectId === project.id && r.employeeId === id),
    }))
    .filter((m) => m.employee)
    .sort((a, b) => (b.usage?.manDays ?? 0) - (a.usage?.manDays ?? 0));
}

/**
 * Shown when a project is completed: the PM rates each engineer who worked on it.
 * Engineers can be skipped and reviewed later from the project page.
 */
export function ReviewTeamDialog({ open, onOpenChange, project }: { open: boolean; onOpenChange: (o: boolean) => void; project: Project }) {
  const { user } = useCurrentUser();
  const team = projectTeam(project, useAppData());
  const save = useSaveProjectReviews();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  // Start from any reviews already saved, each time the dialog opens.
  useEffect(() => {
    if (open) setDrafts(Object.fromEntries(team.map((m) => [m.employee.id, { rating: m.review?.rating ?? 0, comments: m.review?.comments ?? "" }])));
  }, [open, project.id]);

  const setDraft = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...(d[id] ?? { rating: 0, comments: "" }), ...patch } }));
  const rated = Object.entries(drafts).filter(([, d]) => d.rating > 0);

  const submit = () => {
    save.mutate(
      {
        projectId: project.id,
        reviewerId: user.employeeId,
        reviews: rated.map(([employeeId, d]) => ({ employeeId, rating: d.rating as EngineerReview["rating"], comments: d.comments })),
      },
      {
        onSuccess: () => {
          toast.success(`Saved ${rated.length} review${rated.length === 1 ? "" : "s"}`, { description: project.name });
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Review the project team"
        description={`${project.name} is complete. Rate each engineer who worked on it; this goes into their history for performance reviews.`}
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
              Later
            </Button>
            <Button onClick={submit} loading={save.isPending} disabled={rated.length === 0}>
              Save {rated.length > 0 ? rated.length : ""} review{rated.length === 1 ? "" : "s"}
            </Button>
          </>
        }
      >
        {team.length === 0 ? (
          <p className="text-sm text-muted-foreground">No engineers logged time on this project.</p>
        ) : (
          <ul className="space-y-4">
            {team.map(({ employee, usage, role }) => {
              const d = drafts[employee.id] ?? { rating: 0, comments: "" };
              return (
                <li key={employee.id} className="rounded-md border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Avatar name={employee.name} />
                      <div>
                        <p className="text-sm font-medium">{employee.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {role ?? employee.designation} · {formatNumber(usage?.manDays ?? 0, 1)} MD worked · {formatNumber(usage?.idleManDays ?? 0, 1)} idle
                        </p>
                      </div>
                    </div>
                    <StarRating value={d.rating} onChange={(rating) => setDraft(employee.id, { rating })} label={`Rating for ${employee.name}`} />
                  </div>
                  <Textarea
                    className="mt-3"
                    rows={2}
                    value={d.comments}
                    onChange={(e) => setDraft(employee.id, { comments: e.target.value })}
                    placeholder="Strengths, areas to improve, readiness for bigger roles…"
                    aria-label={`Comments for ${employee.name}`}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
