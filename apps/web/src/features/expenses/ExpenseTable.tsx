import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Check, FileText, Paperclip, Receipt as ReceiptIcon, Trash2, X } from "lucide-react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { ExpenseStatusBadge } from "@/components/common/StatusBadges";
import { EmptyState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useApproveExpense, useDeleteExpense, useRejectExpense } from "@/hooks/mutations";
import { useAppData } from "@/hooks/useAppData";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { Expense, Project, User } from "@/types/models";

export function canReviewExpense(user: User, expense: Expense, project: Project | undefined) {
  if (!can(user.role, "expense.approve") || expense.status !== "pending") return false;
  if (expense.employeeId === user.employeeId) return false; // no self-approval
  if (user.role === "management") return true;
  return !!project && project.managerId === user.employeeId;
}

export function ExpenseTable({
  expenses,
  loading,
  hideProject,
  hideEmployee,
  emptyAction,
  pageSize = 10,
}: {
  expenses: Expense[];
  loading?: boolean;
  hideProject?: boolean;
  hideEmployee?: boolean;
  emptyAction?: React.ReactNode;
  pageSize?: number;
}) {
  const { user } = useCurrentUser();
  const { employeeById, projectById } = useAppData();
  const approve = useApproveExpense();
  const reject = useRejectExpense();
  const remove = useDeleteExpense();
  const [rejecting, setRejecting] = useState<Expense | null>(null);
  const [withdrawing, setWithdrawing] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const onApprove = (e: Expense) => {
    setBusyId(e.id);
    approve.mutate(
      { id: e.id, reviewerId: user.employeeId },
      {
        onSuccess: () => toast.success(`${e.code} approved`, { description: `${formatINR(e.amount)} added to ${projectById.get(e.projectId)?.name ?? "project"} cost.` }),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const columns: Column<Expense>[] = [
    { key: "date", header: "Date", cell: (e) => <span className="whitespace-nowrap">{formatDate(e.date)}</span>, sortValue: (e) => e.date },
    ...(!hideEmployee
      ? [{ key: "employee", header: "Employee", className: "whitespace-nowrap", cell: (e: Expense) => employeeById.get(e.employeeId)?.name ?? "—", sortValue: (e: Expense) => employeeById.get(e.employeeId)?.name ?? "" }]
      : []),
    ...(!hideProject
      ? [
          {
            key: "project",
            header: "Project",
            hideOnMobile: true,
            className: "min-w-44",
            cell: (e: Expense) => (
              <Link to={`/projects/${e.projectId}`} className="hover:text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
                {projectById.get(e.projectId)?.name ?? "—"}
              </Link>
            ),
            sortValue: (e: Expense) => projectById.get(e.projectId)?.name ?? "",
          },
        ]
      : []),
    {
      key: "description",
      header: "Category / description",
      sortValue: (e) => e.category,
      cell: (e) => (
        <button className="block max-w-60 text-left hover:text-primary cursor-pointer xl:max-w-80" onClick={() => setViewing(e)} title={e.description}>
          <span className="flex items-center gap-1.5">
            <span className="truncate">{e.description}</span>
            {e.receipt && <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-label="Has receipt" />}
          </span>
          <span className="block text-xs text-muted-foreground">{e.category}</span>
        </button>
      ),
    },
    { key: "amount", header: "Amount", align: "right", className: "whitespace-nowrap", cell: (e) => <span className="tabular font-medium">{formatINR(e.amount)}</span>, sortValue: (e) => e.amount },
    { key: "status", header: "Status", cell: (e) => <ExpenseStatusBadge status={e.status} />, sortValue: (e) => e.status },
    {
      key: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (e) => {
        const project = projectById.get(e.projectId);
        if (canReviewExpense(user, e, project)) {
          return (
            <div className="flex justify-end gap-1.5">
              <Button size="sm" variant="success" loading={busyId === e.id} onClick={() => onApprove(e)}>
                <Check /> Approve
              </Button>
              <Button size="icon-sm" variant="outline" className="text-danger" disabled={busyId === e.id} onClick={() => setRejecting(e)} title="Reject" aria-label={`Reject ${e.code}`}>
                <X />
              </Button>
            </div>
          );
        }
        if (e.status === "pending" && e.employeeId === user.employeeId) {
          return (
            <Button size="sm" variant="ghost" onClick={() => setWithdrawing(e)}>
              <Trash2 /> Withdraw
            </Button>
          );
        }
        return null;
      },
    },
  ];

  const reviewer = viewing?.reviewedById ? employeeById.get(viewing.reviewedById) : null;

  return (
    <>
      <DataTable
        rows={expenses}
        columns={columns}
        rowKey={(e) => e.id}
        loading={loading}
        pageSize={pageSize}
        initialSort={{ key: "date", dir: "desc" }}
        empty={<EmptyState icon={<ReceiptIcon />} title="No expenses found" description="Expenses matching your filters will appear here." action={emptyAction} />}
      />

      <ConfirmDialog
        open={!!rejecting}
        onOpenChange={(o) => !o && setRejecting(null)}
        title={`Reject ${rejecting?.code ?? "expense"}?`}
        description={rejecting && <>The claim of <strong>{formatINR(rejecting.amount)}</strong> by {employeeById.get(rejecting.employeeId)?.name} will not be added to project cost.</>}
        confirmLabel="Reject expense"
        destructive
        noteLabel="Reason for rejection"
        noteRequired
        loading={reject.isPending}
        onConfirm={(note) =>
          rejecting &&
          reject.mutate(
            { id: rejecting.id, reviewerId: user.employeeId, note },
            {
              onSuccess: () => {
                toast.success(`${rejecting.code} rejected`);
                setRejecting(null);
              },
            },
          )
        }
      />

      <ConfirmDialog
        open={!!withdrawing}
        onOpenChange={(o) => !o && setWithdrawing(null)}
        title="Withdraw expense?"
        description="This pending claim will be removed. You can submit it again later."
        confirmLabel="Withdraw"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          withdrawing &&
          remove.mutate(withdrawing.id, {
            onSuccess: () => {
              toast.success("Expense withdrawn");
              setWithdrawing(null);
            },
          })
        }
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && (
          <DialogContent title={`Expense ${viewing.code}`} description={projectById.get(viewing.projectId)?.name}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Employee" value={employeeById.get(viewing.employeeId)?.name} />
              <Detail label="Status" value={<ExpenseStatusBadge status={viewing.status} />} />
              <Detail label="Category" value={viewing.category} />
              <Detail label="Amount" value={<span className="font-semibold">{formatINR(viewing.amount)}</span>} />
              <Detail label="Expense date" value={formatDate(viewing.date)} />
              <Detail label="Submitted" value={formatDateTime(viewing.submittedAt)} />
              <Detail label="Description" value={viewing.description} full />
              {viewing.status !== "pending" && (
                <Detail
                  label={viewing.status === "approved" ? "Approved by" : "Rejected by"}
                  value={`${reviewer?.name ?? "—"}${viewing.reviewedAt ? ` · ${formatDateTime(viewing.reviewedAt)}` : ""}${viewing.reviewNote ? ` — “${viewing.reviewNote}”` : ""}`}
                  full
                />
              )}
              <Detail
                label="Receipt"
                full
                value={
                  viewing.receipt ? (
                    viewing.receipt.dataUrl ? (
                      <img src={viewing.receipt.dataUrl} alt="Receipt" className="mt-1 max-h-64 rounded border" />
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded border bg-muted/50 px-2 py-1">
                        <FileText className="size-4" /> {viewing.receipt.fileName} ({(viewing.receipt.size / 1024).toFixed(0)} KB)
                      </span>
                    )
                  ) : (
                    <span className="text-muted-foreground">No receipt attached</span>
                  )
                }
              />
            </dl>
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}

function Detail({ label, value, full }: { label: string; value: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : undefined}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}
