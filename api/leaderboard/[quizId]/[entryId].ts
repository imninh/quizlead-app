import { handleOnlineApi } from '../../../server/online/api.js'

export async function DELETE(request: Request): Promise<Response> {
  return handleOnlineApi(request)
}
