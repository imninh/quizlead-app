import { handleGhostRunRequest } from '../server/ghostRun.js'

export async function POST(request: Request): Promise<Response> {
  return handleGhostRunRequest(request, {
    fetch: globalThis.fetch,
    env: process.env,
    now: Date.now,
  })
}
