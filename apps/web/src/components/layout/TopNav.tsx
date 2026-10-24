import { NavLink } from "react-router-dom";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

/**
 * "Top bar" view: the main menu as a row of tabs under the header, on laptops only.
 * Phones keep the slide-out menu from the hamburger button.
 */
export function TopNav() {
  const { user, can } = useAuth();
  const items = NAV_ITEMS.filter((i) => !i.permission || can(i.permission));

  return (
    <nav aria-label="Main" className="sticky top-16 z-10 hidden border-b bg-surface lg:block">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-8">
        {items.map((item) => {
          const label = (user && item.labelFor?.[user.role]) ?? item.label;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                  isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              {label}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
