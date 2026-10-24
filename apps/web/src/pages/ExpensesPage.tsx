import { useMemo, useState } from "react";
import { Download, Plus } from "lucide-react";
import { useCurrentUser } from "@/auth/AuthContext";
import { can } from "@/auth/permissions";
import { useScopedData } from "@/hooks/useAppData";
import { useUrlState } from "@/hooks/useUrlState";
import { PageHeader } from "@/components/common/PageHeader";
import { FilterBar, SearchInput } from "@/components/common/FilterBar";
import { ErrorState } from "@/components/common/States";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ExpenseTable } from "@/features/expenses/ExpenseTable";
import { EXPENSE_CATEGORIES, ExpenseFormDialog } from "@/features/expenses/ExpenseFormDialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import { formatINR } from "@/lib/format";
import { todayISO } from "@/lib/dates";
import { includesText, sum } from "@/lib/utils";

export function ExpensesPage() {
  const { user } = useCurrentUser();
  const data = useScopedData();
  const filters = useUrlState(["q", "project", "employee", "category", "from", "to"] as const);
  const f = filters.values;
  const [open, setOpen] = useState(false);
  const isEngineer = user.role === "site_engineer";

  const base = data.scopedExpenses;
  const rows = useMemo(
    () =>
      base.filter(
        (e) =>
          (!f.project || e.projectId === f.project) &&
          (!f.employee || e.employeeId === f.employee) &&
          (!f.category || e.category === f.category) &&
          (!f.from || e.date >= f.from) &&
          (!f.to || e.date <= f.to) &&
          includesText([e.code, e.description, data.employeeById.get(e.employeeId)?.name, data.projectById.get(e.projectId)?.name], f.q),
      ),
    [base, f, data.employeeById, data.projectById],
  );

  const projectOptions = [...new Set(base.map((e) => e.projectId))].map((id) => data.projectById.get(id)).filter((p) => !!p);
  const employeeOptions = [...new Set(base.map((e) => e.employeeId))].map((id) => data.employeeById.get(id)).filter((e) => !!e);
  const thisMonth = todayISO().slice(0, 7);
  const monthRows = rows.filter((e) => e.date.startsWith(thisMonth));
  const byCategory = [...rows.reduce((m, e) => m.set(e.category, (m.get(e.category) ?? 0) + e.amount), new Map<string, number>())].sort((a, b) => b[1] - a[1]);

  const exportCsv = () =>
    downloadCsv(
      `aerosys-expenses-${todayISO()}`,
      toCsv(rows, [
        { header: "Expense ID", value: (e) => e.code },
        { header: "Date", value: (e) => e.date },
        { header: "Employee", value: (e) => data.employeeById.get(e.employeeId)?.name ?? "" },
        { header: "Project", value: (e) => data.projectById.get(e.projectId)?.name ?? "" },
        { header: "Category", value: (e) => e.category },
        { header: "Description", value: (e) => e.description },
        { header: "Amount (INR)", value: (e) => e.amount },
      ]),
    );

  if (data.error) return <ErrorState error={data.error} />;

  return (
    <div>
      <PageHeader
        title={isEngineer ? "My Expenses" : "Expenses"}
        description={
          can(user.role, "expense.create")
            ? "Record site expenses against a project. They count towards the project cost straight away."
            : isEngineer
              ? "Expenses Accounts has recorded against your name."
              : "Expenses recorded by Accounts across projects."
        }
        breadcrumbs={[{ label: "Dashboard", to: "/" }, { label: "Expenses" }]}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download /> Export CSV
            </Button>
            {can(user.role, "expense.create") && (
              <Button onClick={() => setOpen(true)}>
                <Plus /> Add expense
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total (filtered)" value={formatINR(sum(rows, (e) => e.amount))} hint={`${rows.length} expenses`} loading={data.isLoading} />
        <StatCard label="This month" value={formatINR(sum(monthRows, (e) => e.amount))} hint={`${monthRows.length} expenses`} loading={data.isLoading} />
        <StatCard label="Average expense" value={formatINR(rows.length ? sum(rows, (e) => e.amount) / rows.length : 0)} loading={data.isLoading} />
        <StatCard label="Largest category" value={byCategory[0] ? formatINR(byCategory[0][1]) : "—"} hint={byCategory[0]?.[0]} loading={data.isLoading} />
      </div>

      <FilterBar onReset={filters.reset} showReset={filters.active}>
        <SearchInput value={f.q} onChange={(v) => filters.set("q", v)} placeholder="Search ID, description…" />
        <Select value={f.project} onChange={(e) => filters.set("project", e.target.value)} className="w-auto max-w-56" aria-label="Filter by project">
          <option value="">All projects</option>
          {projectOptions.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </Select>
        {!isEngineer && (
          <Select value={f.employee} onChange={(e) => filters.set("employee", e.target.value)} className="w-auto max-w-48" aria-label="Filter by employee">
            <option value="">All employees</option>
            {employeeOptions.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </Select>
        )}
        <Select value={f.category} onChange={(e) => filters.set("category", e.target.value)} className="w-auto" aria-label="Filter by category">
          <option value="">All categories</option>
          {EXPENSE_CATEGORIES.map((c) => (<option key={c}>{c}</option>))}
        </Select>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Input type="date" value={f.from} onChange={(e) => filters.set("from", e.target.value)} className="w-auto" aria-label="From date" />
          <span>to</span>
          <Input type="date" value={f.to} onChange={(e) => filters.set("to", e.target.value)} className="w-auto" aria-label="To date" />
        </div>
      </FilterBar>

      <ExpenseTable
        expenses={rows}
        loading={data.isLoading}
        hideEmployee={isEngineer}
        pageSize={12}
        emptyAction={can(user.role, "expense.create") && !filters.active ? <Button variant="outline" onClick={() => setOpen(true)}><Plus /> Add expense</Button> : undefined}
      />
      <ExpenseFormDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
