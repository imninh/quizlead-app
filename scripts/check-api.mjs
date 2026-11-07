// Kiểm tra API chạy được trên Vercel: dịch từng file .ts sang .js giống cách Vercel đóng gói
// (từng file một, giữ nguyên đường dẫn import), rồi nạp thử mọi file trong api/ bằng Node thuần.
// Bắt được lỗi import trỏ tới file .ts (Vercel chỉ có file .js lúc chạy).
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const root = process.cwd()
const SOURCE_DIRS = ['api', 'server', 'src/domain']

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) return walk(full)
    return full.endsWith('.ts') && !full.endsWith('.test.ts') ? [full] : []
  })
}

const out = mkdtempSync(join(tmpdir(), 'quizlead-check-api-'))
let failed = 0
let apiFiles = []

try {
  for (const dir of SOURCE_DIRS) {
    for (const file of walk(resolve(root, dir))) {
      const js = ts.transpileModule(readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      }).outputText
      const target = join(out, relative(root, file)).replace(/\.ts$/, '.js')
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, js)
    }
  }
  writeFileSync(join(out, 'package.json'), JSON.stringify({ type: 'module' }))
  symlinkSync(resolve(root, 'node_modules'), join(out, 'node_modules'), 'junction')

  apiFiles = readdirSync(join(out, 'api'), { recursive: true })
    .map((name) => String(name))
    .filter((name) => name.endsWith('.js'))
    .sort()

  if (apiFiles.length === 0) {
    console.error('Không tìm thấy file API nào trong app/api/.')
    process.exit(1)
  }

  for (const name of apiFiles) {
    try {
      await import(pathToFileURL(join(out, 'api', name)).href)
      console.log(`OK api/${name.replace(/\\/g, '/').replace(/\.js$/, '.ts')}`)
    } catch (error) {
      failed += 1
      console.error(`FAIL api/${name}: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
    }
  }
} finally {
  rmSync(out, { recursive: true, force: true })
}

if (failed > 0) {
  console.error(`${failed}/${apiFiles.length} file API lỗi khi chạy giống Vercel.`)
  process.exit(1)
}
console.log(`check:api OK — ${apiFiles.length} file API chạy được sau khi dịch giống Vercel.`)
