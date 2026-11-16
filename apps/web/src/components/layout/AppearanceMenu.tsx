import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { Palette, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown";
import { DENSITY_OPTIONS, STYLE_OPTIONS, THEME_OPTIONS, VIEW_OPTIONS, useAppearance, type Appearance } from "@/appearance/AppearanceContext";

/*
 * The app has two copies of this menu: one in the top bar and one in the Calm header. On laptops only one of them is
 * shown, and picking a style can swap which one that is while the menu is open (to Calm: the top bar is hidden; away
 * from Calm: the Calm header goes). A menu whose button is hidden has nothing to hang from and jumps to the corner of
 * the window. So "open" is shared by both copies, and each copy only shows it while its own button is on screen:
 * the menu moves to the visible button and stays open, so several styles can still be tried in a row.
 */
let sharedOpen = false;
const listeners = new Set<() => void>();
const setSharedOpen = (open: boolean) => {
  sharedOpen = open;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSharedOpen = () => sharedOpen;

/** Quick switcher in the top bar, so views and themes can be compared without leaving the current page. */
export function AppearanceMenu() {
  const appearance = useAppearance();
  const navigate = useNavigate();
  const open = useSyncExternalStore(subscribe, getSharedOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  // Watch whether this copy's button is on screen. A size change to nothing means it was hidden (display: none).
  useEffect(() => {
    const el = triggerRef.current;
    if (!el) return;
    const check = () => setVisible(el.getClientRects().length > 0);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // One radio group per setting. `key` is which setting the group controls.
  const group = <K extends keyof Appearance>(label: string, key: K, options: Array<{ value: Appearance[K]; label: string }>) => (
    <>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={appearance[key]} onValueChange={(v) => appearance.set({ [key]: v } as Partial<Appearance>)}>
        {options.map((o) => (
          // preventDefault keeps the menu open so several settings can be tried in a row.
          <DropdownMenuRadioItem key={o.value} value={o.value} onSelect={(e) => e.preventDefault()}>
            {o.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );

  return (
    <DropdownMenu open={open && visible} onOpenChange={setSharedOpen}>
      <DropdownMenuTrigger asChild>
        <Button ref={triggerRef} variant="ghost" size="icon" aria-label="Appearance: style, view and theme">
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[80vh] w-56 overflow-y-auto">
        {group("Style", "style", STYLE_OPTIONS)}
        <DropdownMenuSeparator />
        {group("Theme", "theme", THEME_OPTIONS)}
        <DropdownMenuSeparator />
        {group("View", "view", VIEW_OPTIONS)}
        <DropdownMenuSeparator />
        {group("Size", "density", DENSITY_OPTIONS)}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate("/settings#appearance")}>
          <Settings /> More in Settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
