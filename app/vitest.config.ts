import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['unit/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@core': resolve(__dirname, '../core'),
    },
  },
})
