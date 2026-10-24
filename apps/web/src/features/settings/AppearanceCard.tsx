import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  DENSITY_OPTIONS,
  THEME_OPTIONS,
  VIEW_OPTIONS,
  useAppearance,
  type Density,
  type ThemePref,
  type View,
} from "@/appearance/AppearanceContext";

/**
 * A row of selectable tiles that behaves like a set of radio buttons.
 * It uses real <input type="radio"> elements (visually hidden) so keyboard arrows and screen readers work for free.
 */
function OptionTiles<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  preview,
  columns = "sm:grid-cols-3",
}: {
  name: string;
  legend: string;
  value: T;
  options: Array<{ value: T; label: string; hint: string }>;
  onChange: (v: T) => void;
  preview: (v: T) => ReactNode;
  columns?: string;
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className={cn("grid grid-cols-2 gap-3", columns)}>
        {options.map((o) => (
          <label
            key={o.value}
            className={cn(
              "cursor-pointer rounded-lg border-2 p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
              value === o.value ? "border-primary bg-primary-soft/50" : "border-border hover:border-input",
            )}
          >
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
            <div aria-hidden>{preview(o.value)}</div>
            <p className="mt-2 text-sm font-medium">{o.label}</p>
            <p className="text-xs text-muted-foreground">{o.hint}</p>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Fixed sample colours per theme, so each tile shows its own theme whatever theme is active. */
const THEME_SWATCH: Record<Exclude<ThemePref, "system">, { bg: string; surface: string; side: string; text: string; accent: string }> = {
  light: { bg: "#f6f7f9", surface: "#ffffff", side: "#0c1a2e", text: "#5b6474", accent: "#0b5cab" },
  dark: { bg: "#0b1220", surface: "#121b2c", side: "#080e1a", text: "#9aa7ba", accent: "#5aa5f0" },
  sunlight: { bg: "#ffffff", surface: "#ffffff", side: "#00152b", text: "#000000", accent: "#003f7d" },
};

function ThemePreview({ theme }: { theme: ThemePref }) {
  if (theme === "system") {
    return (
      <div className="flex h-16 overflow-hidden rounded-md border">
        <div className="flex-1"><MiniScreen {...THEME_SWATCH.light} /></div>
        <div className="flex-1"><MiniScreen {...THEME_SWATCH.dark} /></div>
      </div>
    );
  }
  return (
    <div className="h-16 overflow-hidden rounded-md border">
      <MiniScreen {...THEME_SWATCH[theme]} />
    </div>
  );
}

function MiniScreen({ bg, surface, side, text, accent }: (typeof THEME_SWATCH)["light"]) {
  return (
    <div className="flex h-full" style={{ background: bg }}>
      <div className="w-3" style={{ background: side }} />
      <div className="flex-1 space-y-1 p-1.5">
        <div className="h-1.5 w-2/3 rounded-sm" style={{ background: text }} />
        <div className="space-y-1 rounded-sm border p-1" style={{ background: surface, borderColor: `${text}33` }}>
          <div className="h-1 w-full rounded-sm" style={{ background: `${text}66` }} />
          <div className="h-2 w-1/2 rounded-sm" style={{ background: accent }} />
        </div>
      </div>
    </div>
  );
}

/** Line drawings of each navigation layout, drawn with the current theme's tokens. */
function ViewPreview({ view }: { view: View }) {
  const bar = "bg-foreground/25";
  return (
    <div className="flex h-16 gap-1.5">
      {/* Laptop */}
      <div className="flex flex-[3] overflow-hidden rounded-md border bg-background">
        {view !== "topnav" && <div className="w-3 bg-sidebar" />}
        <div className="flex flex-1 flex-col">
          <div className="h-2 border-b bg-surface" />
          {view === "topnav" && <div className="flex h-2 gap-0.5 border-b bg-surface px-1 py-0.5">{[0, 1, 2, 3].map((i) => <div key={i} className={cn("w-2 rounded-sm", i === 0 ? "bg-primary" : bar)} />)}</div>}
          <div className="flex-1 p-1"><div className="h-full rounded-sm border bg-surface" /></div>
        </div>
      </div>
      {/* Phone */}
      <div className="flex w-7 flex-col overflow-hidden rounded-md border bg-background">
        <div className="h-2 border-b bg-surface" />
        <div className="flex-1 p-0.5"><div className="h-full rounded-sm border bg-surface" /></div>
        {view === "field" && <div className="flex h-2.5 items-center justify-around border-t bg-surface px-0.5">{[0, 1, 2].map((i) => <div key={i} className={cn("size-1 rounded-full", i === 0 ? "bg-primary" : bar)} />)}</div>}
      </div>
    </div>
  );
}

function DensityPreview({ density }: { density: Density }) {
  const rows = density === "compact" ? 5 : density === "default" ? 4 : 3;
  return (
    <div className="flex h-16 flex-col justify-between rounded-md border bg-surface p-1.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-1.5 rounded-sm bg-foreground/20" style={{ width: `${90 - i * 12}%` }} />
      ))}
    </div>
  );
}

export function AppearanceCard() {
  const { theme, view, density, set, reset } = useAppearance();
  const ref = useRef<HTMLDivElement>(null);
  const { hash } = useLocation();

  // The top-bar menu links to /settings#appearance; scroll this card into view when that happens.
  useEffect(() => {
    if (hash === "#appearance") ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div ref={ref} id="appearance" className="scroll-mt-32">
      <Card>
        <CardHeader>
          <div>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Choose how the app looks on this device. Changes apply instantly and are saved in this browser only, so a site
              phone and an office laptop can each have their own setup.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <OptionTiles name="theme" legend="Theme" value={theme} options={THEME_OPTIONS} onChange={(v) => set({ theme: v })} preview={(v) => <ThemePreview theme={v} />} columns="sm:grid-cols-4" />
          <OptionTiles name="view" legend="View" value={view} options={VIEW_OPTIONS} onChange={(v) => set({ view: v })} preview={(v) => <ViewPreview view={v} />} />
          <OptionTiles name="density" legend="Size" value={density} options={DENSITY_OPTIONS} onChange={(v) => set({ density: v })} preview={(v) => <DensityPreview density={v} />} />
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw /> Back to original look
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
