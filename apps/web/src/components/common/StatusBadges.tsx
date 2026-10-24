import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { EmployeeStatus, ExpenseStatus, InstrumentStatus, ProjectStatus } from "@/types/models";

type Tone = BadgeProps["tone"];

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  planning: { label: "Planning", tone: "neutral" },
  active: { label: "In Progress", tone: "info" },
  on_hold: { label: "On Hold", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  archived: { label: "Archived", tone: "outline" },
};

export const EXPENSE_STATUS: Record<ExpenseStatus, { label: string; tone: Tone }> = {
  pending: { label: "Pending", tone: "warning" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Rejected", tone: "danger" },
};

export const INSTRUMENT_STATUS: Record<InstrumentStatus, { label: string; tone: Tone }> = {
  available: { label: "Available", tone: "success" },
  assigned: { label: "Assigned", tone: "info" },
  maintenance: { label: "Maintenance", tone: "warning" },
  retired: { label: "Retired", tone: "outline" },
};

export const EMPLOYEE_STATUS: Record<EmployeeStatus, { label: string; tone: Tone }> = {
  active: { label: "Active", tone: "success" },
  on_leave: { label: "On Leave", tone: "warning" },
  inactive: { label: "Inactive", tone: "outline" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const s = PROJECT_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}
export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  const s = EXPENSE_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}
export function InstrumentStatusBadge({ status }: { status: InstrumentStatus }) {
  const s = INSTRUMENT_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}
export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  const s = EMPLOYEE_STATUS[status];
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}
