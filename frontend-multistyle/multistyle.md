# TimeHit Multi-Style Theme System

## How It Works

Tailwind CSS v4 compiles every color utility class (e.g. `bg-brand-600`) into CSS that references a custom property (`background-color: var(--color-brand-600)`). This means themes are just CSS files that override these variables — zero component changes needed for color theming.

A `ThemeProvider` React context sets a `data-theme` attribute on `<html>`. Each theme's CSS is scoped under `[data-theme="<name>"]`, so the matching theme's variables win at runtime.

## Architecture

```
frontend-multistyle/
  themes/
    default/
      theme.css          # [data-theme="light"] { --color-brand-600: ...; }
      metadata.ts         # { id, label, description, preview }
    dark/
      theme.css           # [data-theme="dark"] { ... }
      metadata.ts
    matrix/
      theme.css           # [data-theme="matrix"] { ... } — green-on-black, monospace
      metadata.ts
    index.ts              # barrel export of all theme metadata
  lib/
    theme-context.tsx      # ThemeProvider + useTheme() hook
  app/
    globals.css            # @theme defaults, imports all theme CSS files
    layout.tsx             # wraps app with ThemeProvider, inline script for flash prevention
  components/
    layout/topbar.tsx      # theme picker list in user menu dropdown
```

## Current Themes

| Theme | Brand Color | Background | Font | Description |
|-------|------------|------------|------|-------------|
| Light | Blue `#2563eb` | White `#ffffff` | Inter (sans-serif) | Default clean look |
| VS Code Light | Blue `#007acc` | Light gray `#f3f3f3` | Segoe UI (sans-serif) | VS Code Light+ inspired |
| Dark  | Blue `#3b82f6` | Dark `#13131f` | Inter (sans-serif) | Dark surfaces, light text |
| VS Code Dark | Blue `#007acc` | Dark `#1e1e1e` | Segoe UI (sans-serif) | VS Code Dark+ warm grays |
| Matrix | Green `#00ff41` | Black `#000000` | Fira Code (monospace) | Green phosphor terminal aesthetic |
| Metal | Blood red `#8b0000` | Black `#0a0505` | Metamorphous (gothic serif) | Dark ages, medieval gothic |

## Key Files

| File | Purpose |
|------|---------|
| `app/globals.css` | Defines base tokens via `@theme`, imports all theme CSS files, global form control styling |
| `themes/*/theme.css` | CSS variable overrides scoped to `[data-theme="<name>"]` |
| `themes/*/metadata.ts` | Theme display info + preview colors for the picker UI |
| `themes/index.ts` | Lists all available themes as a typed array |
| `lib/theme-context.tsx` | React context: reads/writes `localStorage("timehit-theme")`, sets `data-theme` on `<html>` |
| `app/layout.tsx` | Mounts ThemeProvider + inline `<script>` to prevent flash of wrong theme on load |
| `components/layout/topbar.tsx` | Theme picker list in user dropdown menu |

## Theme Picker UI

The theme picker lives in the user menu dropdown (topbar). It shows a list of themes, each with:
- A **split-circle swatch** (diagonal gradient: background color top-left, brand color bottom-right)
- The theme **label** text
- Active theme is highlighted with brand color background

The picker auto-populates from `themes/index.ts` — adding a theme there makes it appear in the UI.

## CSS Variable Tokens

### Brand colors (accent/primary)
```
--color-brand-50   # very light tint (hover backgrounds)
--color-brand-100  # light tint
--color-brand-200  # border accents
--color-brand-300  # border accents
--color-brand-600  # primary (buttons, active nav, links)
--color-brand-700  # hover state for primary
```

### Surface & layout
```
--color-surface     # cards, sidebar, topbar, modals, form panels
--color-surface-alt # secondary surface (available, currently unused)
--background        # page/body background
--foreground        # default text color
```

### Font
```
--font-sans         # override to change the entire app's font family
```
Tailwind v4 uses `--font-sans` as the default font. Override it in a theme to switch fonts globally. No component changes needed.

**How fonts are loaded:** Custom fonts are imported via `next/font/google` in `app/layout.tsx`. This downloads fonts at build time and self-hosts them — no Google CDN dependency at runtime. Each font is registered as a CSS variable (e.g. `--font-fira-code`, `--font-gothic`), then themes reference these variables in their `--font-sans` override.

**Current custom fonts:**
- `--font-fira-code` → Fira Code (used by Matrix theme)
- `--font-gothic` → Metamorphous (used by Metal theme)

**To add a new font for a theme:**
1. Import it in `app/layout.tsx`:
   ```ts
   import { YourFont } from "next/font/google";
   const yourFont = YourFont({ subsets: ["latin"], variable: "--font-your-font", display: "swap" });
   ```
2. Add the variable class to `<html>`: `className={`...existing... ${yourFont.variable}`}`
3. Reference it in your theme CSS: `--font-sans: var(--font-your-font), fallback, sans-serif;`

**Important:** `body` in globals.css must use `font-family: var(--font-sans, "Inter", system-ui, sans-serif)` — NOT a hardcoded font name — otherwise theme font overrides won't apply.

**Font selection notes (from testing):**
- UnifrakturMaguntia — true blackletter, completely unreadable for body text
- Grenze Gotisch — gothic but cramped, still hard to read in tables
- Cinzel — beautiful but ALL CAPS only (no lowercase glyphs), confusing for legal/financial content
- **Metamorphous** — the winner: medieval gothic feel, proper lowercase, readable at all sizes

### Gray scale (automatically themed via Tailwind v4 variables)
```
--color-gray-50 through --color-gray-950
```
These control: text colors, borders, dividers, table headers, disabled states, hover states. Override them to shift the entire neutral palette (e.g. Matrix maps grays to greens).

### Status/semantic colors (optional overrides)
```
--color-green-50/100/200/500/700/800   # approved, success
--color-red-50/100/200/500/600/700/800 # rejected, error, destructive
--color-blue-100/700                    # submitted, info
--color-amber-100/700                   # corrected, warning
--color-emerald-100/700                 # paid
--color-purple-100/700                  # contractor invoice badge
--color-yellow-50/800                   # caution
```

## How to Add a New Theme

### 1. Create theme folder
```
mkdir themes/ocean
```

### 2. Create `themes/ocean/theme.css`
```css
[data-theme="ocean"] {
  /* Brand */
  --color-brand-50: #f0f9ff;
  --color-brand-100: #e0f2fe;
  --color-brand-200: #bae6fd;
  --color-brand-300: #7dd3fc;
  --color-brand-600: #0284c7;
  --color-brand-700: #0369a1;

  /* Surfaces */
  --color-surface: #ffffff;
  --color-surface-alt: #f8fafc;
  --background: #f8fafc;
  --foreground: #0f172a;

  /* Optional: override font */
  /* --font-sans: "Georgia", serif; */

  /* Optional: override gray scale for a cooler feel */
  /* --color-gray-50: #f8fafc; */
  /* ... */
}
```

### 3. Create `themes/ocean/metadata.ts`
```ts
export const metadata = {
  id: "ocean",
  label: "Ocean",
  description: "Cool sky-blue tones",
  preview: { brand: "#0284c7", background: "#f8fafc" },
};
```
The `preview` object controls the split-circle swatch in the picker: `background` is top-left, `brand` is bottom-right.

### 4. Register the theme
In `app/globals.css`, add the import:
```css
@import "../themes/ocean/theme.css";
```

In `themes/index.ts`, add:
```ts
import { metadata as oceanTheme } from "./ocean/metadata";
// ...
export const themes: ThemeMetadata[] = [lightTheme, darkTheme, matrixTheme, oceanTheme];
```

That's it. The theme picker will automatically show the new option.

### 5. For dark themes
If your theme has a dark background, you also need to override the gray scale and status colors. See `themes/dark/theme.css` and `themes/matrix/theme.css` as reference. Key points:
- Gray scale should go dark-to-light (gray-50 = darkest, gray-900 = lightest)
- Use transparent RGBA for status color backgrounds (`rgba(22, 163, 74, 0.12)`)
- Use brighter shades for status text colors

## Table Row Striping

Odd/even rows have slightly different backgrounds via `bg-gray-50/40` on every other row in `data-table.tsx`. This adapts automatically to any theme through the gray scale CSS variables.

## Pitfalls & Lessons Learned

### 1. `@theme` vs `:root` ordering (CRITICAL)
Tailwind v4's `@theme` directive generates variables inside `@layer theme` (`:root`). Custom `:root {}` blocks in globals.css are unlayered and come AFTER in cascade, so they **override** `[data-theme="dark"]` selectors.

**Fix:** Put `--background` and `--foreground` inside `@theme {}`, NOT in a separate `:root {}` block. The `@theme` layer has lower priority than unlayered `[data-theme="..."]` selectors, so theme overrides win.

**How to verify:** Use Playwright to check computed values:
```js
await page.evaluate(() => {
  const cs = getComputedStyle(document.documentElement);
  return {
    background: cs.getPropertyValue('--background'),
    surface: cs.getPropertyValue('--color-surface'),
  };
});
```
If `--background` returns the light theme value when dark is active, it's a cascade ordering problem.

### 2. `bg-white` vs `text-white`
`bg-white` is used for surfaces (should become dark in dark mode). `text-white` is used on colored buttons/avatars (must stay white). You can't just override `--color-white`.

**Fix:** Replaced all surface `bg-white` with `bg-surface` (custom token). Toggle switch knobs kept `bg-white` intentionally. Grep for remaining `bg-white` — only toggle knobs in `contractors/[id]/page.tsx` and `profile/page.tsx` should have it.

### 3. `<main>` background
The authenticated layout has `<main>` inside a `flex overflow-hidden` container. Body background doesn't reliably show through nested overflow containers.

**Fix:** Added explicit `bg-[var(--background)]` to the `<main>` element in `app/(authenticated)/layout.tsx`.

### 4. Form controls (inputs, selects, textareas)
Tailwind v4's base reset sets `background-color: transparent` on form elements. In dark mode, inputs appear transparent over the dark background but browsers may render native widgets with white backgrounds.

**Fix:** Added global CSS rule in globals.css:
```css
input, select, textarea {
  background-color: var(--color-surface);
  color: inherit;
  border-color: var(--color-gray-200);
}
option {
  background-color: var(--color-surface);
  color: inherit;
}
```

### 5. Dark mode gray scale design
Don't just invert grays. Design them so:
- `gray-50` = darkest (surface backgrounds, table alt rows)
- `gray-200` = visible border color (not too subtle)
- `gray-500+` = readable text (needs good contrast against dark surfaces)
- `gray-900` = near-white (headings)

### 6. Status colors in dark mode
Use transparent RGBA for backgrounds (`rgba(22, 163, 74, 0.12)` instead of solid colors) and brighter shades for text. This looks natural on dark surfaces.

### 7. Flash of wrong theme on page load
Without prevention, the page renders with default theme for a split second before React hydrates and reads localStorage.

**Fix:** Inline `<script>` in `layout.tsx` `<head>` that synchronously sets `data-theme` before paint:
```tsx
const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('timehit-theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch(e) {}
  })();
`;
```

## What Changes Were Made to Components

### Replaced `bg-white` → `bg-surface` (30 occurrences across 14 files)
All cards, modals, sidebar, topbar, table bodies, form sections, dialogs. Done via `sed` replace. Toggle knob `bg-white` preserved.

### Added `bg-surface` to containers missing background
- `data-table.tsx` — table wrapper div
- `invoices/[id]/page.tsx` — detail cards
- `timesheets/[id]/page.tsx` — table wrappers
- `placements/[id]/page.tsx` — table wrappers, list containers
- `clients/[id]/page.tsx` — list containers
- `generate-invoices-modal.tsx` — list container

### Added alternating row stripes
- `data-table.tsx` — odd rows get `bg-gray-50/40` for subtle striping

### Layout changes
- `app/(authenticated)/layout.tsx` — added `bg-[var(--background)]` to `<main>`
- `app/layout.tsx` — added ThemeProvider wrapper + inline theme script + `suppressHydrationWarning`

### Config changes
- `tailwind.config.ts` — removed `colors.brand` (now in `@theme` CSS)
- `package.json` — dev server port changed to 3002

## Running

```bash
cd frontend-multistyle
./runme.sh              # kills port 3002, builds, starts production server
# or
npm run dev             # dev mode with hot reload on port 3002
```

## Testing Theme Changes

Use Playwright to screenshot and visually verify. Run scripts from `frontend-tests/` directory (where `@playwright/test` is installed):

```js
const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await page.goto('http://localhost:3002/login');
  await page.fill('[data-testid="login-email"]', 'admin@timehit.com');
  await page.fill('[data-testid="login-password"]', 'a');
  await page.click('[data-testid="login-submit"]');
  await page.waitForURL('**/');
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    localStorage.setItem('timehit-theme', 'dark');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/dark-test.png', fullPage: true });
  await browser.close();
})();
```

For large scripts, write them to a temp file and run with `node temp_script.js` rather than inline.
