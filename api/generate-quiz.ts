import { handleGenerateQuizRequest, secureRandom } from '../server/generateQuiz.js'

export async function POST(request: Request): Promise<Response> {
  return handleGenerateQuizRequest(request, {
    fetch: globalThis.fetch,
    env: process.env,
    now: Date.now,
    random: secureRandom,
  })
}
