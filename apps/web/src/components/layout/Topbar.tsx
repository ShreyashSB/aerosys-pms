import { useNavigate } from "react-router-dom";
import { ChevronDown, LogOut, Menu, RefreshCcw, Settings, UserRound } from "lucide-react";
import { useAuth, useCurrentUser } from "@/auth/AuthContext";
import { ROLE_LABELS } from "@/auth/permissions";
import { useEmployees } from "@/hooks/queries";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import type { Role } from "@/types/models";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationCenter } from "./NotificationCenter";

const ROLES: Role[] = ["management", "project_manager", "site_engineer", "accounts"];

export function Topbar({ onOpenMobile }: { onOpenMobile: () => void }) {
  const { user, employee } = useCurrentUser();
  const { users, login, logout, switchRole } = useAuth();
  const { data: employees = [] } = useEmployees();
  const navigate = useNavigate();
  const sameRoleUsers = users.filter((u) => u.role === user.role && u.id !== user.id);
  const nameOf = (employeeId: string) => employees.find((e) => e.id === employeeId)?.name ?? employeeId;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-surface/95 px-4 backdrop-blur lg:px-6">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMobile} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <div className="min-w-0 flex-1">
        <GlobalSearch />
      </div>

      {/* Demo role switcher */}
      <div className="hidden items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary-soft/50 py-1 pl-2.5 pr-1 md:flex">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-primary">Demo role</span>
        <select
          value={user.role}
          onChange={(e) => {
            switchRole(e.target.value as Role);
            navigate("/");
          }}
          className="h-7 cursor-pointer rounded border-0 bg-surface px-2 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-ring/30"
          aria-label="Switch demo role"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <NotificationCenter />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1 pr-2 hover:bg-muted cursor-pointer" aria-label="Profile menu">
            <Avatar name={employee.name} />
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium">{employee.name}</span>
              <span className="block text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-64">
          <DropdownMenuLabel>
            <span className="block text-sm font-medium text-foreground">{employee.name}</span>
            <span className="block font-normal">{employee.designation}</span>
            <span className="block font-normal">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="md:hidden">
            <DropdownMenuLabel>Switch demo role</DropdownMenuLabel>
            {ROLES.filter((r) => r !== user.role).map((r) => (
              <DropdownMenuItem key={r} onSelect={() => { switchRole(r); navigate("/"); }}>
                <RefreshCcw /> {ROLE_LABELS[r]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
          </div>
          {sameRoleUsers.length > 0 && (
            <>
              <DropdownMenuLabel>Switch to another {ROLE_LABELS[user.role]}</DropdownMenuLabel>
              {sameRoleUsers.map((u) => (
                <DropdownMenuItem key={u.id} onSelect={() => { login(u.id); navigate("/"); }}>
                  <UserRound /> {nameOf(u.employeeId)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem onSelect={() => navigate("/settings")}>
            <Settings /> Settings
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => { logout(); navigate("/login"); }}>
            <LogOut /> Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
