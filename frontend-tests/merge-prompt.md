# Prompt: Merge Theme System from frontend-multistyle/ into frontend/

You are merging a theme system that was developed in `frontend-multistyle/` back into the original `frontend/` directory. Both directories exist in this repo.

## Background

`frontend-multistyle/` is a copy of `frontend/` with a complete CSS variable-based theme system added. It supports 6 themes (Light, VS Code Light, Dark, VS Code Dark, Matrix, Metal) switchable at runtime via a theme picker in the user menu. The system works by overriding Tailwind CSS v4 custom properties scoped under `[data-theme="<name>"]` selectors.

Read these files first:
- `frontend-multistyle/multistyle.md` — full documentation of how the theme system works, architecture, pitfalls
- `migration-plan-multistyle.md` — detailed step-by-step merge plan with exact code

## Critical Rules

1. **The original `frontend/` may have newer code than `frontend-multistyle/`** — the copy was made earlier and `frontend/` continued evolving. For every file you modify, DIFF the two versions first. Only apply theme-related changes. Never blindly overwrite with the multistyle version.

2. **Specifically: `app/(authenticated)/layout.tsx`** has newer title logic in `frontend/` (isDetailPage with UUID detection). Keep that logic. Only add `bg-[var(--background)]` to the `<main>` element.

3. **Do NOT change the dev server port.** `frontend/` uses default port 3000. Do not copy the `--port 3002` from multistyle's package.json.

4. **Do NOT copy** `runme.sh` or `multistyle.md` into `frontend/`.

5. **`:root` → `@theme` migration is critical.** The original `frontend/app/globals.css` has `--background` and `--foreground` in a `:root {}` block. This MUST be removed and those variables moved into `@theme {}`. If `:root` remains, it overrides `[data-theme="dark"]` selectors due to CSS cascade ordering, and dark themes will silently fail (background stays white). See multistyle.md Pitfall #1.

6. **`bg-white` → `bg-surface` replacement** — replace surface backgrounds but **keep `bg-white` on toggle switch knobs** in `contractors/[id]/page.tsx` and `profile/page.tsx`. These are white circles on colored tracks and must stay white.

## Steps

### 1. Copy new files

```
cp -r frontend-multistyle/themes frontend/themes
cp frontend-multistyle/lib/theme-context.tsx frontend/lib/theme-context.tsx
```

### 2. Replace `frontend/app/globals.css`

Copy from `frontend-multistyle/app/globals.css`. This file has no app-specific logic — it's pure CSS config, safe to copy entirely.

### 3. Update `frontend/app/layout.tsx`

Copy from `frontend-multistyle/app/layout.tsx`. This adds: ThemeProvider wrapper, Google font imports (Fira_Code, Metamorphous), inline theme script for flash prevention, suppressHydrationWarning. The original has no custom logic here beyond the basic provider structure.

### 4. Update `frontend/app/(authenticated)/layout.tsx`

**DO NOT COPY the multistyle version.** Only make this one change to the original:

```diff
- <main className="flex-1 overflow-y-auto p-6">
+ <main className="flex-1 overflow-y-auto p-6 bg-[var(--background)]">
```

### 5. Update `frontend/components/layout/topbar.tsx`

Diff both versions. Apply these changes to the original:
- Add import: `Palette` from `lucide-react`
- Add import: `useTheme` from `@/lib/theme-context`
- Add `const { theme, setTheme, themes } = useTheme();` in the component
- Replace `bg-white` with `bg-surface` (header bar and dropdown menu)
- Add the theme picker section in the dropdown (list of themes with split-circle color swatches)

If the original topbar has other changes not in multistyle (new menu items, different layout), preserve those and graft the theme picker in.

### 6. Update `frontend/components/layout/sidebar.tsx`

Replace `bg-white` with `bg-surface` in the sidebar container className. That's the only change.

### 7. Update `frontend/tailwind.config.ts`

Remove the `colors.brand` object from `theme.extend`. Keep everything else (fontFamily, content, plugins). Brand colors are now in `@theme` in globals.css.

### 8. Replace `bg-white` → `bg-surface` across files

For each file below, diff the frontend/ and frontend-multistyle/ versions. Apply ONLY the bg-white → bg-surface changes (and bg-surface additions to containers that had no background).

Files:
- `app/login/page.tsx`
- `app/(authenticated)/page.tsx` (dashboard cards)
- `app/(authenticated)/contractors/[id]/page.tsx` — KEEP bg-white on toggle knob
- `app/(authenticated)/profile/page.tsx` — KEEP bg-white on toggle knob
- `app/(authenticated)/invoices/[id]/page.tsx`
- `app/(authenticated)/clients/[id]/page.tsx`
- `app/(authenticated)/placements/[id]/page.tsx`
- `app/(authenticated)/timesheets/[id]/page.tsx`
- `components/data-table/data-table.tsx` — also add `bg-surface` to tbody, add row striping: `i % 2 === 1 && "bg-gray-50/40"` on table rows
- `components/shared/generate-invoices-modal.tsx`
- `components/shared/confirm-dialog.tsx`
- `components/forms/slide-over.tsx`

For files that may have diverged, be surgical — only change `bg-white` to `bg-surface` on surface containers (cards, modals, panels, table bodies). Do not touch `bg-white` on buttons, avatars, or toggle knobs.

## Verification

After all changes:

1. `cd frontend && npm run build` — must succeed
2. `npm run dev` — starts on port 3000
3. Login (admin@test.com / a) → click user avatar → theme picker shows 6 themes
4. Switch to Dark — all surfaces dark, inputs dark, no white rectangles
5. Switch to Matrix — green text, monospace font (Fira Code)
6. Switch to Metal — gothic font (Metamorphous), blood red accents
7. Refresh browser — theme persists
8. Navigate to detail pages — titles still work correctly
9. Check data tables — alternating row striping visible
10. Check toggle switches — white knob stays white on all themes

## Reference

- `migration-plan-multistyle.md` — detailed migration plan with exact file contents, risk notes, and all gaps identified between the two directories
- `frontend-multistyle/multistyle.md` — complete theme system documentation: CSS variables, architecture, pitfalls, how to add themes, font loading, component changes
