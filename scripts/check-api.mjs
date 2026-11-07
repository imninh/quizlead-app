import { readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const apiRoot = resolve(process.cwd(), 'api')

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : []
  })
}

const files = walk(apiRoot).sort()
if (files.length === 0) {
  console.error('Không tìm thấy file API nào trong app/api/.')
  process.exit(1)
}

let failed = 0
for (const file of files) {
  try {
    await import(pathToFileURL(file).href)
    console.log(`OK ${file.slice(process.cwd().length + 1)}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${file.slice(process.cwd().length + 1)}: ${error instanceof Error ? error.message : error}`)
  }
}

if (failed > 0) {
  console.error(`${failed}/${files.length} file API lỗi khi import bằng Node thuần.`)
  process.exit(1)
}
console.log(`check:api OK — ${files.length} file API import được bằng Node thuần.`)
