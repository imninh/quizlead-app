import { handleOnlineApi } from '../../server/online/api.ts'

export async function GET(request: Request): Promise<Response> {
  return handleOnlineApi(request)
}
