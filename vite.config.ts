import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'
import { aiDevPlugin } from './server/devPlugin.ts'
import { applyAbsoluteOg } from './server/ogUrl.ts'

export default defineConfig(({ mode }) => {
  const appRoot = process.cwd()
  const appEnv = loadEnv(mode, appRoot, '')
  const parentEnv = loadEnv(mode, resolve(appRoot, '..'), '')
  const env = { ...parentEnv, ...appEnv, ...process.env }

  return {
    plugins: [
      react(),
      tailwindcss(),
      aiDevPlugin(env),
      {
        name: 'quizlead-og-absolute',
        transformIndexHtml(html) {
          return applyAbsoluteOg(html, env.VITE_APP_URL)
        },
      },
    ],
    test: {
      environment: 'node',
      globals: true,
      include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
      maxWorkers: 4,
      testTimeout: 15000,
      env: { VITE_AI_MODE: 'mock' },
    },
  }
})
