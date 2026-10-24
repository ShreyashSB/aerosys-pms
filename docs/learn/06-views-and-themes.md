# Views and themes (experimental)

The demo now has an **Appearance** setting so different looks can be tried side by side without touching
the original. Nothing changes until someone picks a new option; the default is still the original
light theme with the side menu.

**Where to find it:** the palette icon in the top bar (quick switch), or **Settings → Appearance**
(with small previews). Choices are saved per browser, so a site phone and an office laptop can differ.

## What you can switch

| Setting | Options | Why it exists |
| --- | --- | --- |
| Theme | Light (original), Dark, Sunlight, Match device | Dark for evenings and indoor screens; Sunlight is a high-contrast light theme for phones used outdoors on site |
| View | Classic (original), Top bar, Field | Top bar gives tables the full laptop width; Field puts a thumb-friendly tab bar at the bottom of phones for site engineers |
| Size | Compact, Default, Large | Compact fits more rows on a laptop; Large gives bigger text and tap targets (default buttons ~40px tall) |

All themes were checked for WCAG AA text contrast (4.5:1 or better on body text, badges and buttons).
Sunlight goes further (secondary text is 12:1).

## How it works (React notes)

If you are new to React, these are the moving parts, in the order data flows:

1. **`apps/web/src/appearance/AppearanceContext.tsx`** holds the three choices in React *state* and saves them to
   `localStorage`. It's a *Context provider*: a component that wraps the whole app (see `apps/web/src/main.tsx`)
   so any component can read the choices with the `useAppearance()` *hook*.
2. Every time a choice changes, a `useEffect` writes it onto the `<html>` tag as attributes, e.g.
   `<html data-theme="dark" data-view="field" data-density="comfortable">`.
3. **`apps/web/src/index.css`** reacts to those attributes with plain CSS. Colours in this app are *design tokens*
   (`--color-surface`, `--color-primary`, ...). Components use them through Tailwind classes like
   `bg-surface` and `text-primary`. Each theme just gives the tokens new values, so no component needed
   to change for theming. Density changes the root font size; Tailwind sizes are in `rem`, so text,
   spacing and buttons all scale together.
4. The **view** is the one setting that changes *which components render*, so
   `apps/web/src/components/layout/AppShell.tsx` reads it and shows:
   - `Sidebar` (Classic, and the phone slide-out menu in every view),
   - `TopNav` (Top bar view, laptops), or
   - `BottomNav` (Field view, phones and tablets).
5. **`apps/web/index.html`** has a few lines of script that apply the saved attributes *before* React starts, so the
   page doesn't flash the light theme first when you've picked dark.

## Adding another theme

1. Add a `[data-theme="yourname"] { ... }` block in `apps/web/src/index.css` overriding the colour tokens.
2. Add it to `ThemePref` and `THEME_OPTIONS` in `AppearanceContext.tsx`, and a swatch in
   `THEME_SWATCH` in `apps/web/src/features/settings/AppearanceCard.tsx`.
3. Check contrast: body text needs at least 4.5:1 against its background.

## Small fixes made along the way

- Tables no longer make the whole page scroll sideways on phones (a hidden "Actions" label escaped the
  table's scroll area). Tables still scroll sideways inside their own box.
- Red and green buttons use a token for their text colour, so they stay readable in Dark.
