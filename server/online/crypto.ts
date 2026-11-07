import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

export type AttemptTokenPayload = {
  quizId: string
  version: number
  startedAt: number
  jti: string
  exp: number
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url')
}

export function signHmac(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function createAttemptToken(
  input: { quizId: string; version: number; now: number },
  secret: string,
): { token: string; payload: AttemptTokenPayload } {
  const payload: AttemptTokenPayload = {
    quizId: input.quizId,
    version: input.version,
    startedAt: input.now,
    jti: randomUUID(),
    exp: input.now + 15 * 60 * 1000,
  }
  const encoded = base64url(JSON.stringify(payload))
  return { token: `${encoded}.${signHmac(encoded, secret)}`, payload }
}

export function verifyAttemptToken(token: string, secret: string, now: number): AttemptTokenPayload | null {
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [encoded, signature] = parts
  if (!encoded || !signature) return null
  if (!safeEqual(signature, signHmac(encoded, secret))) return null
  try {
    const payload: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'))
    if (!payload || typeof payload !== 'object') return null
    const value = payload as Partial<AttemptTokenPayload>
    if (
      typeof value.quizId !== 'string' ||
      typeof value.version !== 'number' ||
      typeof value.startedAt !== 'number' ||
      typeof value.jti !== 'string' ||
      typeof value.exp !== 'number'
    ) {
      return null
    }
    if (value.exp <= now) return null
    return value as AttemptTokenPayload
  } catch {
    return null
  }
}

export function phoneKey(secret: string, quizId: string, phone: string): string {
  return createHmac('sha256', secret)
    .update(`${quizId}:${phone}`)
    .digest('hex')
}

export function maskPhone(phone: string): string {
  if (phone.length <= 4) return '******'
  return `${phone.slice(0, 2)}******${phone.slice(-2)}`
}
