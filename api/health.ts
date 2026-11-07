import { handleOnlineApi } from '../server/online/api.js'

export async function GET(request: Request): Promise<Response> {
  return handleOnlineApi(request)
}
