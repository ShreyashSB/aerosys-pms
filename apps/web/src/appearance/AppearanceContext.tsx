/**
 * Appearance settings: theme (colours), view (navigation layout) and density (size).
 *
 * How it works, in short:
 * 1. The user's choices live in React state and are saved to localStorage, so they survive a refresh.
 * 2. Whenever a choice changes, we write it onto the <html> element as data attributes:
 *      <html data-theme="dark" data-view="field" data-density="comfortable">
 * 3. src/index.css has CSS rules for each attribute value (e.g. [data-theme="dark"] swaps the colour tokens).
 *    Because every component uses those tokens (bg-surface, text-foreground, ...), the whole app restyles
 *    itself without any component needing to know which theme is active.
 * 4. The view is the only setting that also changes which components render (sidebar vs. top bar vs. bottom
 *    tabs), so AppShell reads it with the useAppearance() hook.
 *
 * index.html has a tiny inline script that applies the saved attributes before React starts, so the page
 * never flashes the wrong theme on load. Keep STORAGE_KEY and the defaults in sync with that script.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "system" | "light" | "dark" | "sunlight";
export type ResolvedTheme = Exclude<ThemePref, "system">;
export type View = "classic" | "topnav" | "field";
export type Density = "compact" | "default" | "comfortable";

export interface Appearance {
  theme: ThemePref;
  view: View;
  density: Density;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "light", view: "classic", density: "default" };

const STORAGE_KEY = "aerosys.appearance";

/** Labels and one-line descriptions, shared by the quick switcher in the top bar and the Settings page. */
export const THEME_OPTIONS: Array<{ value: ThemePref; label: string; hint: string }> = [
  { value: "light", label: "Light", hint: "The original look" },
  { value: "dark", label: "Dark", hint: "Easier on the eyes indoors and at night" },
  { value: "sunlight", label: "Sunlight", hint: "Extra contrast for bright sites and outdoor use" },
  { value: "system", label: "Match device", hint: "Follows your phone or laptop setting" },
];

export const VIEW_OPTIONS: Array<{ value: View; label: string; hint: string }> = [
  { value: "classic", label: "Classic", hint: "Side menu (the original layout)" },
  { value: "topnav", label: "Top bar", hint: "Menu across the top, more width for tables" },
  { value: "field", label: "Field", hint: "Thumb-friendly tabs at the bottom on phones" },
];

export const DENSITY_OPTIONS: Array<{ value: Density; label: string; hint: string }> = [
  { value: "compact", label: "Compact", hint: "Fit more rows on a laptop" },
  { value: "default", label: "Default", hint: "Balanced" },
  { value: "comfortable", label: "Large", hint: "Bigger text and tap targets" },
];

function isOneOf<T extends string>(v: unknown, options: Array<{ value: T }>): v is T {
  return options.some((o) => o.value === v);
}

function load(): Appearance {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return {
      theme: isOneOf(saved.theme, THEME_OPTIONS) ? saved.theme : DEFAULT_APPEARANCE.theme,
      view: isOneOf(saved.view, VIEW_OPTIONS) ? saved.view : DEFAULT_APPEARANCE.view,
      density: isOneOf(saved.density, DENSITY_OPTIONS) ? saved.density : DEFAULT_APPEARANCE.density,
    };
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

const darkQuery = () => window.matchMedia("(prefers-color-scheme: dark)");

interface AppearanceContextValue extends Appearance {
  /** The theme actually shown: "system" resolved to light or dark. */
  resolvedTheme: ResolvedTheme;
  set: (patch: Partial<Appearance>) => void;
  reset: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(load);
  const [systemDark, setSystemDark] = useState(() => darkQuery().matches);

  // Track the device's light/dark setting so "Match device" updates live.
  useEffect(() => {
    const mq = darkQuery();
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolvedTheme: ResolvedTheme = appearance.theme === "system" ? (systemDark ? "dark" : "light") : appearance.theme;

  // Push the choices onto <html> (see the comment at the top of this file) and remember them.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.view = appearance.view;
    root.dataset.density = appearance.density;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance));
    } catch {
      // Private browsing can block storage; the choice still applies for this visit.
    }
  }, [appearance, resolvedTheme]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...appearance,
      resolvedTheme,
      set: (patch) => setAppearance((a) => ({ ...a, ...patch })),
      reset: () => setAppearance(DEFAULT_APPEARANCE),
    }),
    [appearance, resolvedTheme],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside <AppearanceProvider>");
  return ctx;
}
