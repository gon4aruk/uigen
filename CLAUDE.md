# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

UIGen is a Next.js 15 (App Router) app that lets a user chat with Claude to generate React components, rendered live in an in-browser preview — no files are ever written to disk. Everything (components, generated code, chat) is stored in a virtual, in-memory file system and persisted to SQLite (via Prisma) only when a signed-in user saves a project.

## Commands

```bash
npm run setup       # install deps + prisma generate + prisma migrate dev (run once after clone)
npm run dev          # start dev server (Next.js + Turbopack) at localhost:3000
npm run build        # production build
npm run lint         # next lint
npm test             # run vitest test suite (jsdom environment)
npm run db:reset      # reset the SQLite dev database (prisma migrate reset --force)
```

Run a single test file: `npx vitest run src/lib/__tests__/file-system.test.ts`
Run tests matching a name: `npx vitest run -t "test name"`

No `ANTHROPIC_API_KEY` is required to run the app — see "Mock provider" below.

## Architecture

### Virtual file system is the source of truth

`src/lib/file-system.ts` (`VirtualFileSystem`) implements an in-memory tree (path -> `FileNode`) with file/directory CRUD, rename, and Anthropic-text-editor-style operations (`viewFile`, `createFileWithParents`, `replaceInFile`, `insertInFile`). Nothing is ever written to the real filesystem. It is:
- Instantiated client-side inside `FileSystemProvider` (`src/lib/contexts/file-system-context.tsx`) and used by the editor/preview UI.
- Reconstructed server-side in `src/app/api/chat/route.ts` per-request from the serialized state the client sends, so the AI's tool calls operate on a fresh instance, then re-serialized and returned via tool results.
- Serialized to JSON (`serialize()`/`deserializeFromNodes()`) and stored in `Project.data` in SQLite when a project is saved.

### Chat -> tool calls -> file system -> preview loop

1. `ChatProvider` (`src/lib/contexts/chat-context.tsx`) uses the Vercel AI SDK's `useChat`, POSTing `{ messages, files: fileSystem.serialize(), projectId }` to `/api/chat`.
2. The route (`src/app/api/chat/route.ts`) rebuilds a `VirtualFileSystem` from `files`, then calls `streamText` with two tools bound to that instance:
   - `str_replace_editor` — Anthropic's provider-defined text editor tool (`src/lib/tools/str-replace.ts`), commands: `view`, `create`, `str_replace`, `insert` (`undo_edit` is a stub).
   - `file_manager` — custom tool (`src/lib/tools/file-manager.ts`) for `rename`/`delete`.
3. On the client, `onToolCall` in `ChatProvider` forwards every tool call to `handleToolCall` in `FileSystemProvider`, which replays the same operation against the client-side `VirtualFileSystem` and bumps `refreshTrigger` to re-render the file tree/editor/preview. The server and client file systems are kept in sync by replaying identical tool calls on both sides, not by sharing state.
4. `onFinish` in the route persists `messages` + `fileSystem.serialize()` to the `Project` row (only if `projectId` is present and the user is authenticated).

### Live preview (no bundler)

`src/lib/transform/jsx-transformer.ts` builds the preview without webpack/esbuild:
- Transpiles each JS/JSX/TS/TSX file individually with `@babel/standalone` (React automatic runtime).
- Wraps each transpiled file in a `Blob` and builds a browser **import map** (`createImportMap`) mapping every possible import specifier (with/without leading slash, with/without extension, `@/`-alias form) to its blob URL. Third-party bare imports are resolved to `https://esm.sh/<pkg>`. Missing local imports get an auto-generated placeholder module so the app doesn't crash on an unresolved import.
- `createPreviewHTML` produces a full HTML document (Tailwind via CDN script, an import map, a React error boundary, and an inline module script that imports the entry point) which is set as an `<iframe srcDoc>` in `PreviewFrame` (`src/components/preview/PreviewFrame.tsx`). Entry point resolution tries `/App.jsx`, `/App.tsx`, `/index.jsx`, `/index.tsx`, `/src/App.jsx`, `/src/App.tsx`, else the first `.jsx`/`.tsx` file found.

### Mock provider (no API key needed)

`src/lib/provider.ts`'s `getLanguageModel()` returns a real `anthropic("claude-3-7-sonnet-latest")` model when `ANTHROPIC_API_KEY` is set, otherwise a `MockLanguageModel` that fakes a multi-step tool-calling conversation (counter/form/card component canned code) so the whole generate -> tool-call -> preview loop is exercisable offline. The chat route uses fewer `maxSteps` (4 vs 40) when running against the mock provider to avoid the mock repeating itself.

### Auth & persistence

- JWT-based sessions (`jose`) stored in an httpOnly cookie, managed by `src/lib/auth.ts` (`createSession`/`getSession`/`deleteSession`/`verifySession`). `JWT_SECRET` env var, defaults to a dev secret if unset.
- `src/middleware.ts` blocks unauthenticated requests to `/api/projects` and `/api/filesystem` (note: these path prefixes aren't currently implemented as routes — project mutations go through Server Actions instead).
- Server Actions in `src/actions/` (`create-project.ts`, `get-project.ts`, `get-projects.ts`) are the actual read/write path for `Project` rows and require a session.
- Prisma models (`prisma/schema.prisma`): `User` (email/password) and `Project` (`userId` nullable, `messages`/`data` stored as JSON strings). SQLite dev DB at `prisma/dev.db`. Generated client outputs to `src/generated/prisma` (not the default `node_modules` location) — import it via `@/lib/prisma`, not directly.
- Anonymous users can generate components without signing in; their in-progress work (messages + file system state) is cached in `sessionStorage` by `src/lib/anon-work-tracker.ts` so it can be offered back to them if they sign up/in later.

### UI layout

`src/app/main-content.tsx` composes the whole app: resizable chat panel (left) + tabbed Preview/Code panel (right, using `react-resizable-panels`), all wrapped in `FileSystemProvider` > `ChatProvider`. `CodeEditor` uses Monaco; UI primitives under `src/components/ui/` are shadcn/ui (new-york style, see `components.json`).

## Database

The database schema is defined in `prisma/schema.prisma` — reference it any time you need to understand the structure of data stored in the database.

## Code Style

Use comments sparingly — only for genuinely complex or non-obvious code, not routine logic.

## Testing

Vitest + jsdom + Testing Library (`vitest.config.mts`). Tests live in `__tests__` folders next to the code they cover (e.g. `src/lib/__tests__/`, `src/lib/contexts/__tests__/`, `src/components/*/__tests__/`). Path alias `@/*` -> `src/*` is resolved via `vite-tsconfig-paths`, matching `tsconfig.json`.
