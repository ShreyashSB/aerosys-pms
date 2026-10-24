import type { Badge } from "@/components/ui/badge";
import type { Employee, ProjectAssignment } from "@/types/models";
import type { ComponentProps } from "react";

export function engineerLoad(employeeId: string, assignments: ProjectAssignment[]) {
  const open = assignments.filter((a) => a.employeeId === employeeId && !a.endDate);
  return { open, allocation: open.reduce((s, a) => s + a.allocation, 0) };
}

export function availabilityOf(emp: Employee, allocation: number): { label: string; tone: ComponentProps<typeof Badge>["tone"]; key: string } {
  if (emp.status === "on_leave") return { label: "On leave", tone: "warning", key: "on_leave" };
  if (emp.status === "inactive") return { label: "Inactive", tone: "outline", key: "inactive" };
  if (allocation === 0) return { label: "Available", tone: "success", key: "available" };
  if (allocation < 100) return { label: `Partially free (${100 - allocation}%)`, tone: "info", key: "partial" };
  return { label: "Fully deployed", tone: "neutral", key: "deployed" };
}
