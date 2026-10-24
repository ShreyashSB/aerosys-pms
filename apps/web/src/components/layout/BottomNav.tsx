import { NavLink } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";

/** How many pages get their own tab. The rest sit behind "More", which opens the usual side menu. */
const TAB_COUNT = 4;

/**
 * "Field" view: a tab bar fixed to the bottom of the screen on phones and tablets, where a thumb can
 * reach it one-handed. Laptops keep the sidebar.
 */
export function BottomNav({ onOpenMore }: { onOpenMore: () => void }) {
  const { user, can } = useAuth();
  const items = NAV_ITEMS.filter((i) => i.to !== "/settings" && (!i.permission || can(i.permission))).slice(0, TAB_COUNT);

  const tab = "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium leading-none";

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-20 flex border-t bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      {items.map((item) => {
        // Short labels so five tabs fit on a narrow phone: "My Projects" becomes "Projects".
        const label = ((user && item.labelFor?.[user.role]) ?? item.label).replace(/^My /, "").replace("Site Engineers", "Engineers");
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) => cn(tab, isActive ? "text-primary" : "text-muted-foreground")}
          >
            {({ isActive }) => (
              <>
                <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", isActive && "bg-primary-soft")}>
                  <item.icon className="size-5" />
                </span>
                <span className="max-w-full truncate">{label}</span>
              </>
            )}
          </NavLink>
        );
      })}
      <button type="button" onClick={onOpenMore} className={cn(tab, "cursor-pointer text-muted-foreground")}>
        <span className="flex h-7 w-12 items-center justify-center">
          <Menu className="size-5" />
        </span>
        More
      </button>
    </nav>
  );
}
