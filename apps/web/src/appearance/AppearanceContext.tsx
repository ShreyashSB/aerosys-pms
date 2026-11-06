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
 * 4. View "Match device" (the default) picks Field on phones and tablets and Classic on laptops, and follows
 *    the screen live (e.g. when a phone is rotated). Picking Classic, Top bar or Field by hand always wins.
 * 5. The view is the only setting that also changes which components render (sidebar vs. top bar vs. bottom
 *    tabs), so AppShell reads it with the useAppearance() hook.
 *
 * index.html has a tiny inline script that applies the saved attributes before React starts, so the page
 * never flashes the wrong theme on load. Keep STORAGE_KEY and the defaults in sync with that script.
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type ThemePref = "system" | "light" | "dark" | "sunlight";
export type ResolvedTheme = Exclude<ThemePref, "system">;
export type ViewPref = "auto" | "classic" | "topnav" | "field";
export type View = Exclude<ViewPref, "auto">;
export type Density = "compact" | "default" | "comfortable";

export interface Appearance {
  theme: ThemePref;
  view: ViewPref;
  density: Density;
}

export const DEFAULT_APPEARANCE: Appearance = { theme: "light", view: "auto", density: "default" };

const STORAGE_KEY = "aerosys.appearance";
/** Bumped when "Match device" was added. Older saves always stored the then-default "classic" view, even when
 * nobody picked it, so a v1 "classic" is read as "Match device" so phones get Field view. */
const STORAGE_VERSION = 2;

/**
 * A phone or tablet: a narrow screen, or a touch screen with no mouse (this also catches a phone held sideways,
 * which can be wider than 768px). Screen size and pointer type rather than the browser's user-agent string,
 * which is unreliable. Keep in sync with the copy in index.html.
 */
export const MOBILE_QUERY = "(max-width: 767.98px), (hover: none) and (pointer: coarse)";

/** Labels and one-line descriptions, shared by the quick switcher in the top bar and the Settings page. */
export const THEME_OPTIONS: Array<{ value: ThemePref; label: string; hint: string }> = [
  { value: "light", label: "Light", hint: "The original look" },
  { value: "dark", label: "Dark", hint: "Easier on the eyes indoors and at night" },
  { value: "sunlight", label: "Sunlight", hint: "Extra contrast for bright sites and outdoor use" },
  { value: "system", label: "Match device", hint: "Follows your phone or laptop setting" },
];

export const VIEW_OPTIONS: Array<{ value: ViewPref; label: string; hint: string }> = [
  { value: "auto", label: "Match device", hint: "Field on phones and tablets, Classic on laptops" },
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
    if (saved.v !== STORAGE_VERSION && saved.view === "classic") saved.view = "auto";
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
const mobileQuery = () => window.matchMedia(MOBILE_QUERY);

/** Live result of a media query. */
function useMediaQuery(get: () => MediaQueryList) {
  const [matches, setMatches] = useState(() => get().matches);
  useEffect(() => {
    const mq = get();
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [get]);
  return matches;
}

interface AppearanceContextValue extends Appearance {
  /** The theme actually shown: "system" resolved to light or dark. */
  resolvedTheme: ResolvedTheme;
  /** The layout actually shown: "Match device" resolved to field or classic. */
  resolvedView: View;
  set: (patch: Partial<Appearance>) => void;
  reset: () => void;
}

const AppearanceContext = createContext<AppearanceContextValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(load);
  // Track the device's light/dark setting and screen type so "Match device" updates live.
  const systemDark = useMediaQuery(darkQuery);
  const isMobile = useMediaQuery(mobileQuery);

  const resolvedTheme: ResolvedTheme = appearance.theme === "system" ? (systemDark ? "dark" : "light") : appearance.theme;
  const resolvedView: View = appearance.view === "auto" ? (isMobile ? "field" : "classic") : appearance.view;

  // Push the choices onto <html> (see the comment at the top of this file) and remember them.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.view = resolvedView;
    root.dataset.density = appearance.density;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...appearance, v: STORAGE_VERSION }));
    } catch {
      // Private browsing can block storage; the choice still applies for this visit.
    }
  }, [appearance, resolvedTheme, resolvedView]);

  const value = useMemo<AppearanceContextValue>(
    () => ({
      ...appearance,
      resolvedTheme,
      resolvedView,
      set: (patch) => setAppearance((a) => ({ ...a, ...patch })),
      reset: () => setAppearance(DEFAULT_APPEARANCE),
    }),
    [appearance, resolvedTheme, resolvedView],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const ctx = useContext(AppearanceContext);
  if (!ctx) throw new Error("useAppearance must be used inside <AppearanceProvider>");
  return ctx;
}
