# Kaldi

Kaldi includes an interactive Electron app in the `app/` directory. The app uses Vite for the React renderer and launches an Electron desktop window in development.

## Run the App

From the repo root:

```sh
cd app
npm install
npm run dev
```

`npm run dev` starts the Vite dev server at `http://localhost:5173` and then opens the Electron app window.

If dependencies are already installed, `npm install` can be skipped.

## Production Build

To build the renderer:

```sh
cd app
npm run build
```

To preview the Vite build in a browser:

```sh
cd app
npm run preview
```

The Electron main process loads `app/renderer/dist/index.html` when `VITE_DEV_SERVER_URL` is not set.
