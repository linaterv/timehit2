# Migration Plan: Merge Theme System from frontend-multistyle/ into frontend/

## Context

The theme system was developed in `frontend-multistyle/` (a copy of `frontend/`). The original `frontend/` has since diverged slightly (e.g., improved title logic in authenticated layout). This plan merges theme support into `frontend/` while preserving original improvements.

## multistyle.md Gaps (for merge purposes)

`multistyle.md` is excellent as documentation but has these gaps as a merge guide:

1. **Missing files from bg-surface list** — sidebar.tsx, confirm-dialog.tsx, slide-over.tsx, login/page.tsx not mentioned in "What Changes Were Made" section (actual: 38 occurrences in 16 files, docs say 30 in 14)
2. **Title logic divergence** — original `frontend/` has newer detail-page title detection (`isDetailPage` with UUID check) that multistyle doesn't have. Must keep original's title logic during merge
3. **`:root` block in original** — original `globals.css` still uses `:root {}` for --background/--foreground. The `@theme` migration is documented in "Pitfalls" but not called out as a merge step
4. **Port change should NOT be merged** — multistyle uses port 3002, original should stay at default 3000

---

## Step 1: Copy new files into frontend/

```bash
# Theme directory (6 themes + barrel export)
cp -r frontend-multistyle/themes frontend/themes

# Theme context provider
cp frontend-multistyle/lib/theme-context.tsx frontend/lib/theme-context.tsx
```

**New files:**
- `themes/default/theme.css` + `metadata.ts` — Light theme
- `themes/dark/theme.css` + `metadata.ts` — Dark theme
- `themes/matrix/theme.css` + `metadata.ts` — Matrix (green on black, monospace)
- `themes/vscode-light/theme.css` + `metadata.ts` — VS Code Light+
- `themes/vscode-dark/theme.css` + `metadata.ts` — VS Code Dark+
- `themes/metal/theme.css` + `metadata.ts` — Metal/Gothic (blood red, Metamorphous font)
- `themes/index.ts` — Barrel export + ThemeMetadata type
- `lib/theme-context.tsx` — ThemeProvider + useTheme hook

## Step 2: Update app/globals.css

**File:** `frontend/app/globals.css`

Replace entire contents with:

```css
@import "tailwindcss";
@import "../themes/default/theme.css";
@import "../themes/dark/theme.css";
@import "../themes/matrix/theme.css";
@import "../themes/vscode-dark/theme.css";
@import "../themes/vscode-light/theme.css";
@import "../themes/metal/theme.css";

@theme {
  --color-brand-50: #eff6ff;
  --color-brand-100: #dbeafe;
  --color-brand-200: #bfdbfe;
  --color-brand-300: #93c5fd;
  --color-brand-600: #2563eb;
  --color-brand-700: #1d4ed8;
  --color-surface: #ffffff;
  --color-surface-alt: #f9fafb;
  --background: #f9fafb;
  --foreground: #111827;
}

body {
  background-color: var(--background);
  color: var(--foreground);
  font-family: var(--font-sans, "Inter", system-ui, sans-serif);
}

/* Form controls inherit theme colors */
input,
select,
textarea {
  background-color: var(--color-surface);
  color: inherit;
  border-color: var(--color-gray-200);
}

option {
  background-color: var(--color-surface);
  color: inherit;
}
```

**Critical changes:**
- Added 6 theme CSS imports
- Expanded `@theme` with brand-200, brand-300, --color-surface, --color-surface-alt
- **Moved** --background and --foreground from `:root {}` into `@theme {}` (cascade ordering fix — see multistyle.md Pitfall #1)
- **Removed** the `:root {}` block entirely
- Changed body font to `var(--font-sans, ...)` for theme font overrides
- Added form control styles for dark mode compatibility

## Step 3: Update app/layout.tsx

**File:** `frontend/app/layout.tsx`

Replace entire contents with:

```tsx
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { QueryProvider } from "@/lib/query-provider";
import { ThemeProvider } from "@/lib/theme-context";
import { Fira_Code, Metamorphous } from "next/font/google";

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-fira-code",
  display: "swap",
});

const metamorphous = Metamorphous({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-gothic",
  display: "swap",
});

export const metadata = { title: "TimeHit" };

const themeScript = `
  (function() {
    try {
      var t = localStorage.getItem('timehit-theme');
      if (t) document.documentElement.dataset.theme = t;
    } catch(e) {}
  })();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${firaCode.variable} ${metamorphous.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <QueryProvider>
          <AuthProvider>
            <ThemeProvider>{children}</ThemeProvider>
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
```

**Changes:** ThemeProvider wrapper, Google font imports (Fira Code + Metamorphous), inline theme script for flash prevention, suppressHydrationWarning

## Step 4: Update app/(authenticated)/layout.tsx

**File:** `frontend/app/(authenticated)/layout.tsx`

**IMPORTANT:** Keep the original's title logic (isDetailPage with UUID detection). Only change the `<main>` line:

```diff
- <main className="flex-1 overflow-y-auto p-6">
+ <main className="flex-1 overflow-y-auto p-6 bg-[var(--background)]">
```

Do NOT overwrite with multistyle's simpler title logic.

## Step 5: Update components/layout/topbar.tsx

**File:** `frontend/components/layout/topbar.tsx`

Copy from multistyle version:
```bash
cp frontend-multistyle/components/layout/topbar.tsx frontend/components/layout/topbar.tsx
```

**Changes:** Theme picker UI in dropdown, bg-white → bg-surface, Palette icon import, useTheme integration

## Step 6: Update components/layout/sidebar.tsx

**File:** `frontend/components/layout/sidebar.tsx`

Replace `bg-white` with `bg-surface` in the sidebar container className.

## Step 7: Update tailwind.config.ts

**File:** `frontend/tailwind.config.ts`

Remove the `colors.brand` section from `theme.extend`. Keep `fontFamily`. The brand colors are now defined in `@theme` in globals.css.

## Step 8: Replace bg-white → bg-surface across component/page files

**Files to update (all under frontend/):**

| File | Notes |
|------|-------|
| `app/login/page.tsx` | Form container + input |
| `app/(authenticated)/page.tsx` | Dashboard stat cards |
| `app/(authenticated)/contractors/[id]/page.tsx` | Section cards. **Keep bg-white on toggle knob** |
| `app/(authenticated)/profile/page.tsx` | Section cards. **Keep bg-white on toggle knob** |
| `app/(authenticated)/invoices/[id]/page.tsx` | Detail cards |
| `app/(authenticated)/clients/[id]/page.tsx` | Cards + list container |
| `app/(authenticated)/placements/[id]/page.tsx` | Cards + tbody + list + confirm dialog |
| `app/(authenticated)/timesheets/[id]/page.tsx` | Cards + tbody + list + confirm dialog |
| `components/data-table/data-table.tsx` | Table wrapper + tbody bg-surface + row striping (`bg-gray-50/40`) |
| `components/shared/generate-invoices-modal.tsx` | Modal + list container |
| `components/shared/confirm-dialog.tsx` | Dialog background |
| `components/forms/slide-over.tsx` | Panel background |

**Approach:** For each file, diff the frontend/ and frontend-multistyle/ versions. Apply only the bg-white → bg-surface changes (and row striping for data-table). Some files may have other divergences — only take theme-related hunks.

**Toggle knob exceptions:** In `contractors/[id]/page.tsx` and `profile/page.tsx`, the toggle switch knob uses `bg-white` intentionally (white circle on colored track). Do NOT replace these.

## Step 9: Do NOT change

- `package.json` — keep default port 3000 (don't copy port 3002)
- `runme.sh` — multistyle-specific, don't copy
- `multistyle.md` — optionally copy as documentation reference

---

## Verification Checklist

1. `cd frontend && npm run build` — must succeed with zero errors
2. `npm run dev` — starts on port 3000
3. Login → click user avatar → theme picker shows 6 themes with color swatches
4. Switch to **Dark** → all surfaces dark, form controls dark, no white flashes
5. Switch to **Matrix** → green text, monospace Fira Code font
6. Switch to **Metal** → gothic Metamorphous font, blood red accent
7. Switch to **VS Code Dark/Light** → correct color schemes
8. Browser refresh → theme persists (localStorage)
9. Navigate to a detail page (e.g., `/placements/[id]`) → title displays correctly (isDetailPage logic preserved)
10. Check data tables → alternating row striping visible
11. Check forms (user create, client edit) → inputs have themed backgrounds in dark mode
12. Toggle switches → white knob on colored track (not themed)

## Risk Notes

- **Biggest trap:** If `:root {}` block is not removed from globals.css, dark themes will appear to not work (background stays white). See multistyle.md Pitfall #1.
- **Font loading:** Fonts are downloaded at build time via `next/font/google` — no runtime CDN dependency. If build fails on font download, check network.
- **File divergence:** Some page files may have been updated in `frontend/` since the multistyle copy was made. Always diff before overwriting — only apply theme-related changes.
