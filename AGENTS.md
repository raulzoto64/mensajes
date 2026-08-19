# Ephemera

React + Vite + Tailwind CSS chat messaging app with Supabase backend.

## Development Server

- `npm run dev` starts the Vite dev server on port 8443
- `npm run build` creates a production build
- `npm run preview` serves the production build locally

## Project Structure

- `src/main.tsx` - React entrypoint; imports `src/index.css` and mounts `src/App.tsx` into the `#root` element
- `src/App.tsx` - Primary application component
- `src/index.css` - Global CSS entrypoint and Tailwind CSS v4 import
- `index.html` - Vite HTML shell containing the `#root` element and loading `src/main.tsx`
- `src/lib/supabase.ts` - Supabase client and database types
- `src/lib/auth.ts` - Local alias/password authentication logic
- `supabase/schema.sql` - Database schema for Supabase (execute in SQL Editor)
- `.env` - Supabase credentials (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- `package.json` - Project dependencies and scripts
- `vite.config.ts` - Vite configuration with React and Tailwind CSS v4 plugins plus the `@` alias for `src`

## Dependencies

- Runtime: React 19 and React DOM 19
- Backend: @supabase/supabase-js
- Styling: Tailwind CSS v4 with the `@tailwindcss/vite` plugin
- Build tooling: Vite 8, TypeScript 5.7, and `@vitejs/plugin-react`

## Code quality

- Use double quotes for strings containing apostrophes (`"We're here to help"`), or escape them in single-quoted strings.
- Ensure JSX tags are closed and braces are balanced.
- Export components as default exports.