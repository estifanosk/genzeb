# LedgerBox

LedgerBox includes an interactive Electron app in the `app/` directory. The app uses Vite for the React renderer and launches an Electron desktop window in development.

## Run the App

From the repo root:

```sh
cd app
npm install
npm run dev
```

`npm run dev` starts the Vite dev server at `http://localhost:5173` and then opens the Electron app window.

If dependencies are already installed, `npm install` can be skipped.

## Smoke Test

Use [smoke-test.md](smoke-test.md) with the sample statement in
`test-data/statements/` to verify import, materialization, and transaction
editing against a disposable data folder.

## Production Build

To build the renderer:

```sh
cd app
npm run build
```

The Electron/Vite build writes bundled output to `app/out/`.
