# LedgerBox

LedgerBox is a local-first desktop expense workspace built with Electron, React, Vite, and TypeScript.

## Layout

- `app/` contains the Electron shell, renderer UI, and build config.
- `core/` contains the domain logic for importing, materializing, receipts, rules, and shared types.
- `test-data/` contains disposable sample input for smoke tests.
- `docs/` contains the design notes, app notes, and smoke-test instructions.

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
