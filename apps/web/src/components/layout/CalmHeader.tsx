import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Moon, Search, Sun, X } from "lucide-react";
import { useAuth } from "@/auth/AuthContext";
import { useAppearance } from "@/appearance/AppearanceContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AppearanceMenu } from "./AppearanceMenu";
import { GlobalSearch } from "./GlobalSearch";
import { LogoMark } from "./Logo";
import { NotificationCenter } from "./NotificationCenter";
import { ProfileMenu } from "./Topbar";
import { NAV_ITEMS } from "./nav";

/**
 * Calm style header for laptops: logo, the main menu as a row of pills inside one rounded track (the active page is
 * a dark pill that slides between items), then round icon buttons and the profile. Same menu items and permissions
 * as the side menu. Phones keep the normal top bar and the chosen view (slide-out menu or bottom tabs), restyled by CSS.
 */
export function CalmHeader() {
  const { user, can } = useAuth();
  const { resolvedTheme, set } = useAppearance();
  const location = useLocation();
  // Settings stays in the profile menu, like on the reference design, to keep the pill row short.
  const items = NAV_ITEMS.filter((i) => i.to !== "/settings" && (!i.permission || can(i.permission)));
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Sliding active pill: measure the active link and move one shared highlight under it.
  const trackRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = trackRef.current?.querySelector<HTMLElement>('a[aria-current="page"]');
      setPill(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener("resize", measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener("resize", measure);
  }, [location.pathname, items.length]);

  useEffect(() => {
    if (searchOpen) searchRef.current?.querySelector("input")?.focus();
  }, [searchOpen]);

  return (
    <header data-slot="calm-header" data-ground className="sticky top-0 z-20 hidden lg:block">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-6 py-4 xl:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5 rounded-full" aria-label="Aerosys HVAC home">
          <span className="flex size-11 items-center justify-center rounded-full border border-[var(--calm-line)]">
            <LogoMark className="size-7" />
          </span>
          <span className="hidden text-lg font-semibold tracking-tight text-foreground 2xl:block">aerosys</span>
        </Link>

        <nav aria-label="Main" className="min-w-0 flex-1">
          <div ref={trackRef} className="relative mx-auto flex w-fit max-w-full items-center gap-0.5 overflow-x-auto rounded-full border border-[var(--calm-line)] bg-[var(--calm-glass)] p-1 [scrollbar-width:none]">
            {pill && (
              <span
                aria-hidden
                className="absolute top-1 bottom-1 rounded-full bg-[var(--calm-pill)] shadow-sm transition-[left,width] duration-300 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-none"
                style={{ left: pill.left, width: pill.width }}
              />
            )}
            {items.map((item) => {
              const label = ((user && item.labelFor?.[user.role]) ?? item.label).replace(/^My /, "");
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    cn(
                      "relative z-10 flex shrink-0 items-center rounded-full px-2.5 py-2 text-[13px] font-medium transition-colors duration-300 xl:px-3.5 xl:text-sm",
                      isActive ? "text-[var(--calm-pill-fg)]" : "text-foreground hover:bg-[var(--calm-glass)]",
                    )
                  }
                >
                  {label}
                </NavLink>
              );
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 xl:gap-2">
          <div className="relative">
            <Button variant="ghost" size="icon" aria-label={searchOpen ? "Close search" : "Search"} aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
              {searchOpen ? <X className="size-5" /> : <Search className="size-5" />}
            </Button>
            {searchOpen && (
              <div ref={searchRef} className="absolute right-0 top-12 z-30 w-[26rem] rounded-2xl bg-surface p-2 shadow-xl" onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}>
                <GlobalSearch />
              </div>
            )}
          </div>
          {/* Quick light/dark switch; hidden on smaller laptops so the pill menu fits (the palette menu has themes too). */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden xl:inline-flex"
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => set({ theme: resolvedTheme === "dark" ? "light" : "dark" })}
          >
            {resolvedTheme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
          <AppearanceMenu />
          <NotificationCenter />
          <ProfileMenu alwaysShowRoleSwitch />
        </div>
      </div>
    </header>
  );
}
