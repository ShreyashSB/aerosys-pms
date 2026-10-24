import { BarChart3, FolderKanban, HardHat, LayoutDashboard, Receipt, Settings, Users, Wrench, type LucideIcon } from "lucide-react";
import type { Permission } from "@/auth/permissions";
import type { Role } from "@/types/models";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  /** Role-specific label overrides, e.g. "My Expenses" for engineers. */
  labelFor?: Partial<Record<Role, string>>;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban, labelFor: { site_engineer: "My Projects", project_manager: "My Projects" } },
  { to: "/engineers", label: "Site Engineers", icon: HardHat, permission: "engineer.view" },
  { to: "/expenses", label: "Expenses", icon: Receipt, labelFor: { site_engineer: "My Expenses" } },
  { to: "/instruments", label: "Instruments", icon: Wrench, permission: "instrument.view", labelFor: { site_engineer: "My Instruments" } },
  { to: "/employees", label: "Employees", icon: Users, permission: "employee.view" },
  { to: "/reports", label: "Reports", icon: BarChart3, permission: "report.view" },
  { to: "/settings", label: "Settings", icon: Settings },
];
