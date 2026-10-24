import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Progress } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { HealthBadge } from "@/components/common/Health";
import { CostBreakdown } from "@/features/dashboard/CostBreakdown";
import { useForm, type Errors } from "@/hooks/useForm";
import { useCreateProjectCost, useDeleteProjectCost } from "@/hooks/mutations";
import { costHealth, expenseHealth, manDayHealth, type Health } from "@/domain/health";
import type { ProjectPerformance } from "@/domain/performance";
import { todayISO } from "@/lib/dates";
import { formatDate, formatINR, formatNumber, formatPct } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AppSettings, Project, ProjectCost, ProjectCostType } from "@/types/models";
import { PnlStatement } from "../PnlDrawer";
import type { MetricKey } from "../explainers";

const TYPE_LABEL: Record<ProjectCostType, string> = { subcontract: "Sub-contract", hire: "Equipment hire", other: "Other" };

export function CostsTab({
  project,
  perf: p,
  settings,
  costs,
  canEdit,
  onExplain,
}: {
  project: Project;
  perf: ProjectPerformance;
  settings: AppSettings;
  costs: ProjectCost[];
  canEdit: boolean;
  onExplain: (k: MetricKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<ProjectCost | null>(null);
  const del = useDeleteProjectCost();

  const budgetRows: Array<{ label: string; allotted: number; consumed: number; fmt: (n: number) => string; health: Health; key?: MetricKey }> = [
    { label: "Man-days", allotted: p.allottedManDays, consumed: p.consumedManDays, fmt: (n) => `${formatNumber(n, 1)} MD`, health: manDayHealth(p), key: "manDays" },
    { label: "Expenses", allotted: p.allottedExpenses, consumed: p.consumedExpenses, fmt: formatINR, health: expenseHealth(p), key: "expenses" },
    { label: "Total cost", allotted: p.budget, consumed: p.costs.total, fmt: formatINR, health: costHealth(p) },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Budget / allotted vs actual / consumed</CardTitle>
            <CardDescription>Progress to date: {formatPct(p.progress * 100)} — consumption should stay roughly in step</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted-foreground">
                <tr className="border-b">
                  <th className="px-5 py-2 text-left font-medium" />
                  <th className="px-3 py-2 text-right font-medium">Budget / allotted</th>
                  <th className="px-3 py-2 text-right font-medium">Actual / consumed</th>
                  <th className="px-3 py-2 text-right font-medium">Remaining</th>
                  <th className="w-44 px-3 py-2 text-left font-medium">Utilised</th>
                  <th className="px-5 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {budgetRows.map((r) => {
                  const util = r.allotted ? (r.consumed / r.allotted) * 100 : 0;
                  return (
                    <tr key={r.label}>
                      <td className="px-5 py-3 font-medium">
                        {r.key ? <button className="hover:text-primary hover:underline cursor-pointer" onClick={() => onExplain(r.key!)}>{r.label}</button> : r.label}
                      </td>
                      <td className="px-3 py-3 text-right tabular">{r.fmt(r.allotted)}</td>
                      <td className="px-3 py-3 text-right font-medium tabular">{r.fmt(r.consumed)}</td>
                      <td className={cn("px-3 py-3 text-right tabular", r.allotted - r.consumed < 0 && "text-danger")}>{r.fmt(r.allotted - r.consumed)}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={Math.min(100, util)} tone={r.health.tone === "bad" ? "warning" : "primary"} />
                          <span className="w-10 text-right text-xs tabular">{formatPct(util, 0)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right"><HealthBadge health={r.health} /></td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/30">
                  <td className="px-5 py-3 font-medium">Projected final cost <span className="text-xs font-normal text-muted-foreground">(estimate)</span></td>
                  <td className="px-3 py-3 text-right tabular">{formatINR(p.budget)}</td>
                  <td className="px-3 py-3 text-right font-medium tabular">{formatINR(p.finalCost)}</td>
                  <td className={cn("px-3 py-3 text-right tabular", p.budget - p.finalCost < 0 ? "text-danger" : "text-success")}>
                    {p.budget - p.finalCost >= 0 ? "Under by " : "Over by "}{formatINR(Math.abs(p.budget - p.finalCost))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cost engine</CardTitle>
              <CardDescription>Actual cost to date by head — click a row for its calculation</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <CostBreakdown costs={p.costs} budget={p.budget} onSelect={(h) => onExplain(h as MetricKey)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Profit & loss</CardTitle>
              <CardDescription>From work order value to projected profit</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <PnlStatement
              settings={settings}
              data={{
                title: project.name,
                contractValue: p.contractValue,
                costs: p.costs,
                earnedValue: p.earnedValue,
                remainingCost: p.remainingCost,
                finalCost: p.finalCost,
                finalProfit: p.finalProfit,
                finalMarginPct: p.finalMarginPct,
                projectionMethod: p.projectionMethod,
                progress: p.progress,
              }}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Other direct costs</CardTitle>
            <CardDescription>Sub-contract labour, equipment hire and similar costs not raised as expenses</CardDescription>
          </div>
          {canEdit && <Button size="sm" onClick={() => setOpen(true)}><Plus /> Add cost</Button>}
        </CardHeader>
        <CardContent className="px-0">
          {costs.length === 0 ? (
            <p className="px-5 py-4 text-sm text-muted-foreground">No other direct costs recorded.</p>
          ) : (
            <ul className="divide-y text-sm">
              {[...costs].sort((a, b) => b.date.localeCompare(a.date)).map((x) => (
                <li key={x.id} className="flex items-center gap-3 px-5 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{x.description}</p>
                    <p className="text-xs text-muted-foreground">{TYPE_LABEL[x.type] ?? x.type} · {formatDate(x.date)}</p>
                  </div>
                  <span className="font-medium tabular">{formatINR(x.amount)}</span>
                  {canEdit && <Button variant="ghost" size="icon-sm" onClick={() => setDeleting(x)} aria-label="Delete cost entry"><Trash2 className="text-muted-foreground" /></Button>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AddCostDialog open={open} onOpenChange={setOpen} projectId={project.id} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete cost entry?"
        description={deleting && <>{deleting.description} — {formatINR(deleting.amount)} will be removed from project cost.</>}
        destructive
        confirmLabel="Delete"
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id, { onSuccess: () => { toast.success("Cost entry deleted"); setDeleting(null); } })}
      />
    </div>
  );
}

type Values = { type: ProjectCostType; description: string; amount: string; date: string };

function AddCostDialog({ open, onOpenChange, projectId }: { open: boolean; onOpenChange: (o: boolean) => void; projectId: string }) {
  const create = useCreateProjectCost();
  const form = useForm<Values>({ type: "subcontract", description: "", amount: "", date: todayISO() }, (v) => {
    const e: Errors<Values> = {};
    if (!v.description.trim()) e.description = "Description is required";
    if (!(Number(v.amount) > 0)) e.amount = "Enter an amount";
    return e;
  });
  const { values: v, errors, set } = form;
  const submit = form.handleSubmit((vals) =>
    create.mutate(
      { projectId, type: vals.type, description: vals.description.trim(), amount: Number(vals.amount), date: vals.date },
      {
        onSuccess: () => {
          toast.success("Cost added", { description: `${formatINR(Number(vals.amount))} added to project cost` });
          form.reset();
          onOpenChange(false);
        },
      },
    ),
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add direct cost"
        footer={
          <>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" form="cost-form" loading={create.isPending}>Add cost</Button>
          </>
        }
      >
        <form id="cost-form" onSubmit={submit} className="grid grid-cols-2 gap-4" noValidate>
          <Field label="Type" htmlFor="c-type">
            <Select id="c-type" value={v.type} onChange={(e) => set("type", e.target.value as ProjectCostType)}>
              {(Object.keys(TYPE_LABEL) as ProjectCostType[]).map((t) => (<option key={t} value={t}>{TYPE_LABEL[t]}</option>))}
            </Select>
          </Field>
          <Field label="Date" htmlFor="c-date">
            <Input id="c-date" type="date" value={v.date} onChange={(e) => set("date", e.target.value)} />
          </Field>
          <Field label="Description" htmlFor="c-desc" required error={errors.description} className="col-span-2">
            <Input id="c-desc" value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="e.g. Scissor lift hire – 2 weeks" aria-invalid={!!errors.description} />
          </Field>
          <Field label="Amount (₹)" htmlFor="c-amt" required error={errors.amount}>
            <Input id="c-amt" type="number" min={0} value={v.amount} onChange={(e) => set("amount", e.target.value)} aria-invalid={!!errors.amount} />
          </Field>
        </form>
      </DialogContent>
    </Dialog>
  );
}
