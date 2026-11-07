import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { handleGenerateQuizRequest, secureRandom } from './generateQuiz.ts'
import { handleGhostRunRequest } from './ghostRun.ts'
import { handleOnlineRequest } from './online/handler.ts'

const MAX_BODY_BYTES = 2048
const MAX_GHOST_BODY_BYTES = 16384
const MAX_ONLINE_BODY_BYTES = 32768

function toHeaders(request: IncomingMessage): Headers {
  const headers = new Headers()
  for (const [key, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) headers.set(key, value.join(','))
    else if (typeof value === 'string') headers.set(key, value)
  }
  return headers
}

async function readBody(request: IncomingMessage, response: ServerResponse, maxBytes = MAX_BODY_BYTES): Promise<Uint8Array | null> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    total += buffer.byteLength
    if (total > maxBytes) {
      response.statusCode = 413
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.end(JSON.stringify({ ok: false, code: 'INVALID_INPUT', message: 'Dữ liệu yêu cầu quá lớn.' }))
      return null
    }
    chunks.push(buffer)
  }
  return new Uint8Array(Buffer.concat(chunks))
}

export function aiDevPlugin(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'quizlead-ai-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api/generate-quiz', async (request, response) => {
        try {
          const body = request.method === 'POST' ? await readBody(request, response) : undefined
          if (body === null) return
          const url = `http://127.0.0.1/api/generate-quiz`
          const requestBody = body ? new Uint8Array(body).buffer : undefined
          const httpRequest = new Request(url, {
            method: request.method,
            headers: toHeaders(request),
            body: requestBody,
          })
          const result = await handleGenerateQuizRequest(httpRequest, {
            fetch: globalThis.fetch,
            env,
            now: Date.now,
            random: secureRandom,
            ip: request.socket.remoteAddress ?? 'local',
          })
          response.statusCode = result.status
          result.headers.forEach((value, key) => response.setHeader(key, value))
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await result.text())
        } catch {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ ok: false, code: 'CONFIG', message: 'AI chưa được cấu hình.' }))
        }
      })
      server.middlewares.use('/api/ghost-run', async (request, response) => {
        try {
          const body = request.method === 'POST' ? await readBody(request, response, MAX_GHOST_BODY_BYTES) : undefined
          if (body === null) return
          const httpRequest = new Request('http://127.0.0.1/api/ghost-run', {
            method: request.method,
            headers: toHeaders(request),
            body: body ? new Uint8Array(body).buffer : undefined,
          })
          const result = await handleGhostRunRequest(httpRequest, {
            fetch: globalThis.fetch,
            env,
            now: Date.now,
            ip: request.socket.remoteAddress ?? 'local',
          })
          response.statusCode = result.status
          result.headers.forEach((value, key) => response.setHeader(key, value))
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await result.text())
        } catch {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ ok: false, code: 'CONFIG', message: 'AI chưa được cấu hình.' }))
        }
      })
      server.middlewares.use('/api', async (request, response, next) => {
        const path = (request.url ?? '').split('?')[0] ?? ''
        const known =
          path === '/health' ||
          path === '/admin/check' ||
          path === '/quizzes' ||
          path === '/attempts/start' ||
          path === '/scores' ||
          path.startsWith('/quizzes/') ||
          path.startsWith('/leaderboard/')
        if (!known) {
          next()
          return
        }
        try {
          const needsBody = request.method !== 'GET' && request.method !== 'DELETE'
          const body = needsBody ? await readBody(request, response, MAX_ONLINE_BODY_BYTES) : undefined
          if (body === null) return
          const httpRequest = new Request(`http://127.0.0.1/api${path}`, {
            method: request.method,
            headers: toHeaders(request),
            body: body ? new Uint8Array(body).buffer : undefined,
          })
          const result = await handleOnlineRequest(httpRequest, path, {
            env,
            now: Date.now,
            ip: request.socket.remoteAddress ?? 'local',
          })
          response.statusCode = result.status
          result.headers.forEach((value, key) => response.setHeader(key, value))
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(await result.text())
        } catch {
          response.statusCode = 500
          response.setHeader('Content-Type', 'application/json; charset=utf-8')
          response.end(JSON.stringify({ ok: false, code: 'UPSTREAM', message: 'Không xử lý được yêu cầu online.' }))
        }
      })
    },
  }
}
