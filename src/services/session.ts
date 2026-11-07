import { z } from 'zod'
import type { GameState } from '../domain/game'
import { STORAGE_PREFIX } from '../domain/constants'
import { AttemptSchema, GameStateSchema, type Attempt } from '../domain/schemas'

const KEY = STORAGE_PREFIX + 'session'
const PENDING_RESULT_KEY = STORAGE_PREFIX + 'pendingResult'
const ONLINE_TOKEN_KEY = STORAGE_PREFIX + 'onlineAttemptToken'

export function saveSession(state: GameState): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ quizId: state.quiz?.id ?? null, state }))
  } catch {
    // ignore
  }
}

export function loadSession(): { quizId: string | null; state: GameState } | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const schema = z.object({ quizId: z.string().nullable(), state: GameStateSchema })
    const result = schema.safeParse(parsed)
    if (!result.success) return null
    return result.data
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** Lưu tạm kết quả khi localStorage đầy, để trang kết quả vẫn hiện điểm. */
export function savePendingResult(attempt: Attempt): void {
  try {
    sessionStorage.setItem(PENDING_RESULT_KEY, JSON.stringify(attempt))
  } catch {
    // ignore
  }
}

export function loadPendingResult(attemptId?: string): Attempt | null {
  try {
    const raw = sessionStorage.getItem(PENDING_RESULT_KEY)
    if (!raw) return null
    const result = AttemptSchema.safeParse(JSON.parse(raw))
    if (!result.success) return null
    if (attemptId && result.data.id !== attemptId) return null
    return result.data
  } catch {
    return null
  }
}

export function clearPendingResult(): void {
  try {
    sessionStorage.removeItem(PENDING_RESULT_KEY)
  } catch {
    // ignore
  }
}

export function saveOnlineAttemptToken(token: string): void {
  try {
    sessionStorage.setItem(ONLINE_TOKEN_KEY, token)
  } catch {
    // ignore
  }
}

export function loadOnlineAttemptToken(): string | null {
  try {
    return sessionStorage.getItem(ONLINE_TOKEN_KEY)
  } catch {
    return null
  }
}

export function clearOnlineAttemptToken(): void {
  try {
    sessionStorage.removeItem(ONLINE_TOKEN_KEY)
  } catch {
    // ignore
  }
}
