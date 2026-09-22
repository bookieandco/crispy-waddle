import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: [
      { find: '@jhadina/action-core', replacement: path.resolve(__dirname, '../jhadina-action-core/src') },
    ],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  },
})
