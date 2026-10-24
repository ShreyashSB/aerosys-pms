import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { FileText, Paperclip, Receipt as ReceiptIcon, Trash2 } from "lucide-react";
import { DataTable, type Column } from "@/components/common/DataTable";
import { EmptyState } from "@/components/common/States";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useDeleteExpense } from "@/hooks/mutations";
import { useAppData } from "@/hooks/useAppData";
import { formatDate, formatDateTime, formatINR } from "@/lib/format";
import type { Expense } from "@/types/models";

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
  const remove = useDeleteExpense();
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  // Accounts records expenses, so Accounts also removes a wrong entry.
  const canDelete = can(user.role, "expense.create");

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
    ...(canDelete
      ? [
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            align: "right" as const,
            cell: (e: Expense) => (
              <Button size="icon-sm" variant="ghost" className="text-danger" onClick={() => setDeleting(e)} aria-label={`Delete ${e.code}`} title="Delete">
                <Trash2 />
              </Button>
            ),
          },
        ]
      : []),
  ];

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
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.code ?? "expense"}?`}
        description={deleting && <>The <strong>{formatINR(deleting.amount)}</strong> {deleting.category} expense will be removed from {projectById.get(deleting.projectId)?.name ?? "the project"}'s cost.</>}
        confirmLabel="Delete expense"
        destructive
        loading={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, {
            onSuccess: () => {
              toast.success(`${deleting.code} deleted`);
              setDeleting(null);
            },
          })
        }
      />

      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        {viewing && (
          <DialogContent title={`Expense ${viewing.code}`} description={projectById.get(viewing.projectId)?.name}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Detail label="Employee" value={employeeById.get(viewing.employeeId)?.name} />
              <Detail label="Category" value={viewing.category} />
              <Detail label="Amount" value={<span className="font-semibold">{formatINR(viewing.amount)}</span>} />
              <Detail label="Expense date" value={formatDate(viewing.date)} />
              <Detail label="Recorded" value={formatDateTime(viewing.submittedAt)} />
              <Detail label="Description" value={viewing.description} full />
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
