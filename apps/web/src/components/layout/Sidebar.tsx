import { NavLink } from "react-router-dom";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { Logo } from "./Logo";

export function Sidebar({
  collapsed,
  onToggle,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const { user, can } = useAuth();
  const items = NAV_ITEMS.filter((i) => !i.permission || can(i.permission));

  return (
    <>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={onCloseMobile} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground transition-[width,transform] duration-200 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
          collapsed ? "lg:w-[68px]" : "lg:w-60",
          "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className={cn("flex h-16 items-center border-b border-white/10", collapsed ? "justify-center px-2" : "px-4")}>
          <Logo collapsed={collapsed} light />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2" aria-label="Main">
          {items.map((item) => {
            const label = (user && item.labelFor?.[user.role]) ?? item.label;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                onClick={onCloseMobile}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    collapsed && "lg:justify-center lg:px-0",
                    isActive ? "bg-sidebar-active text-white" : "hover:bg-white/5 hover:text-white",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={cn("size-[18px] shrink-0", isActive ? "text-sky-300" : "text-sidebar-foreground/70 group-hover:text-white")} />
                    <span className={cn(collapsed && "lg:hidden")}>{label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <button
          onClick={onToggle}
          className="hidden items-center gap-2 border-t border-white/10 px-4 py-3 text-xs text-sidebar-foreground/70 hover:text-white lg:flex cursor-pointer"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="mx-auto size-4" /> : (<><ChevronsLeft className="size-4" /> Collapse</>)}
        </button>
      </aside>
    </>
  );
}
