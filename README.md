# Originkit library

The Originkit component library site: `/` is the landing page (foundation and animation components in one live grid), and `/core` is the foundation components with live previews, controls and usage.

```bash
pnpm install
cp .env.example .env.local   # optional: Supabase read-only keys
pnpm dev                     # http://localhost:3200
```

Without Supabase keys the page still renders; the animation grid, templates and counts are empty.
Links to animation components, templates and pricing point at `NEXT_PUBLIC_ORIGINKIT_SITE_URL` (default `https://www.originkit.dev`).

The 32 foundation components are in `lib/originkit-library` and are Framer-safe (`framer` is aliased to `./framer-shim`).
