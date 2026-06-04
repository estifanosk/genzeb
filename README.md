# LedgerBox

LedgerBox is a local-first desktop expense workspace built with Electron, React, Vite, and TypeScript.

## Layout

- `app/` contains the Electron shell, renderer UI, and build config.
- `core/` contains the domain logic for importing, materializing, receipts, rules, and shared types.
- `test-data/` contains disposable sample input for smoke tests.
- `smoke-test.md` documents the manual verification flow against a temporary data folder.

## Run

From the repo root:

```sh
cd app
npm install
npm run dev
```

`npm run dev` starts the renderer dev server and opens the Electron app.

## Verify

Use [smoke-test.md](smoke-test.md) with the sample CSV in `test-data/statements/` to verify import, materialization, and transaction editing against a disposable data folder.

## Build

```sh
cd app
npm run build
```

The bundled Electron output is written to `app/out/`.
