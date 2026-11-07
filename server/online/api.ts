import { handleOnlineRequest } from './handler.ts'

export function handleOnlineApi(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname.replace(/^\/api/, '')
  return handleOnlineRequest(request, path, { env: process.env, now: Date.now })
}
