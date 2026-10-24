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
import { DENSITY_OPTIONS, THEME_OPTIONS, VIEW_OPTIONS, useAppearance, type Appearance } from "@/appearance/AppearanceContext";

/** Quick switcher in the top bar, so views and themes can be compared without leaving the current page. */
export function AppearanceMenu() {
  const appearance = useAppearance();
  const navigate = useNavigate();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Appearance: view and theme">
          <Palette className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="max-h-[80vh] w-56 overflow-y-auto">
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
