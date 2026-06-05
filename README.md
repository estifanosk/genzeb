# LedgerBox

LedgerBox is a local-first desktop expense workspace built with Electron, React, Vite, and TypeScript.

## Tech stack

| Layer | Technology |
|---|---|
| Desktop shell | [Electron 39](https://www.electronjs.org/) |
| Build tooling | [electron-vite 5](https://electron-vite.org/), [Vite 7](https://vite.dev/) |
| UI framework | [React 19](https://react.dev/) |
| Language | [TypeScript 5](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS 4](https://tailwindcss.com/) |
| UI components | [Radix UI](https://www.radix-ui.com/) primitives + [shadcn/ui](https://ui.shadcn.com/) patterns, [Lucide](https://lucide.dev/) icons |
| Table / virtualisation | [@tanstack/react-table](https://tanstack.com/table), [@tanstack/react-virtual](https://tanstack.com/virtual) |
| State management | [Zustand 5](https://zustand.pmnd.rs/) |
| CSV parsing | [PapaParse 5](https://www.papaparse.com/) |
| SQLite index | [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Date handling | [date-fns 4](https://date-fns.org/) |
| Validation | [Zod 4](https://zod.dev/) |
| LLM integration | OpenAI API (opt-in, user-supplied key) |

## Layout

- `app/` contains the Electron shell, renderer UI, and build config.
- `core/` contains the domain logic for importing, materializing, receipts, rules, and shared types.
- `test-data/` contains disposable sample input for smoke tests.
- `docs/` contains the design notes, app notes, and how-tos.

See [docs/architecture.md](docs/architecture.md) for a full breakdown of the process model, data pipeline, IPC layer, and data folder layout.

## Run

From the repo root:

```sh
cd app
npm install
npm run dev
```

`npm run dev` starts the renderer dev server and opens the Electron app.

## Test data

Seed realistic transactions, receipts, and categories into the app's data folder with a single command:

```sh
cd app
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/seed.ts
```

To wipe everything and start fresh:

```sh
NODE_PATH=./node_modules npx tsx --tsconfig tsconfig.node.json ../scripts/clean.ts
```

See [docs/seed-data.md](docs/seed-data.md) for full details on what is generated and how to target a custom data folder.

## Verify

Use [docs/smoke-test.md](docs/smoke-test.md) with the sample CSV in `test-data/statements/` to verify import, materialization, and transaction editing against a disposable data folder.

## Build

```sh
cd app
npm run build
```

The bundled Electron output is written to `app/out/`.
