import { handleOnlineApi } from '../../../server/online/api.ts'

export async function DELETE(request: Request): Promise<Response> {
  return handleOnlineApi(request)
}
