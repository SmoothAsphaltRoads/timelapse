# Timelapse

Browser-first study verification platform scaffold built with Next.js App Router.

## Stack
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- PWA shell (manifest + service worker)
- Supabase client scaffolding

## Getting Started

1. Copy environment template:

```bash
cp .env.example .env.local
```

2. Fill in Supabase values in `.env.local`.

3. Install dependencies and run dev server:

```bash
npm install
npm run dev
```

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
npm run start
```

## Structure

- `src/app` — routes and layouts
- `src/components` — shared UI and layout primitives
- `src/lib` — env + Supabase client scaffolding
- `public` — static assets, icons, and service worker
- `docs/architecture` — architecture and data-flow docs
- `supabase/migrations` — database schema migrations
