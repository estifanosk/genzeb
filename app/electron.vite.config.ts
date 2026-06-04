import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    resolve: {
      alias: {
        '@core': resolve('../core')
      }
    }
  },
  preload: {
    resolve: {
      alias: {
        '@core': resolve('../core')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@core': resolve('../core'),
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
