import { handleOnlineApi } from '../server/online/api.js'

export async function POST(request: Request): Promise<Response> {
  return handleOnlineApi(request)
}
