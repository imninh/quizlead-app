import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

describe('api entry points', () => {
  it('every api file imports in plain node without missing extensions', () => {
    const result = execFileSync(process.execPath, ['scripts/check-api.mjs'], {
      cwd: resolve(import.meta.dirname, '..', '..'),
      encoding: 'utf8',
    })
    expect(result).toContain('check:api OK')
    expect(result).toMatch(/OK api[\\/]health\.ts/)
  })
})
