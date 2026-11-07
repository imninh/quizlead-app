import { handleOnlineApi } from '../server/online/api.ts'

export async function POST(request: Request): Promise<Response> {
  return handleOnlineApi(request)
}
