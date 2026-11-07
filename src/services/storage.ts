import { z } from 'zod'
import {
  QuizSchema,
  LeadSchema,
  AttemptSchema,
  SettingsSchema,
  ProfileSchema,
  type Quiz,
  type Lead,
  type Attempt,
  type Settings,
  type Profile,
} from '../domain/schemas'
import { STORAGE_PREFIX } from '../domain/constants'
import { SEED_QUIZ, DEFAULT_SETTINGS } from '../domain/seed'
import { upsertLeadByPhone } from '../domain/leaderboard'
import { createId } from '../domain/id'
import { MSG } from '../domain/messages'

export type StorageResult<T> =
  | { ok: true; data: T; warning?: 'RECOVERED_CORRUPT' }
  | { ok: false; error: { code: 'QUOTA_EXCEEDED' | 'STORAGE_UNAVAILABLE' | 'NOT_FOUND' | 'INVALID'; message: string } }

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> & {
  readonly length?: number
  key?: (index: number) => string | null
}

export type RecoveryNotice = {
  /** Khoá localStorage đầy đủ, ví dụ `quizlead:v1:leads`. */
  key: string
  label: string
  backupKey: string
  at: number
}

export type BackupInfo = {
  key: string
  name: string
  label: string
  at: number
  bytes: number
}

export type StorageUsage = {
  bytes: number
  keys: number
}

const BACKUP_PREFIX = STORAGE_PREFIX + 'backup:'

const DATA_LABELS: Record<string, string> = {
  quizzes: 'Danh sách quiz',
  leads: 'Danh sách khách hàng',
  attempts: 'Danh sách lượt chơi',
  settings: 'Cài đặt',
  activeQuizId: 'Quiz đang chạy',
  profile: 'Hồ sơ người chơi',
}

export function labelForDataName(name: string): string {
  return DATA_LABELS[name] ?? name
}

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  setItem(k: string, v: string) { this.data.set(k, v) }
  removeItem(k: string) { this.data.delete(k) }
}

export function getSafeStorage(): { storage: StorageLike; persistent: boolean } {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { storage: new MemoryStorage(), persistent: false }
    }
    const testKey = STORAGE_PREFIX + '__test__'
    window.localStorage.setItem(testKey, '1')
    window.localStorage.removeItem(testKey)
    return { storage: window.localStorage, persistent: true }
  } catch {
    return { storage: new MemoryStorage(), persistent: false }
  }
}

export function createStorageRepo(
  storage?: StorageLike,
  now: () => number = () => Date.now(),
  persistent = true,
) {
  const safe = storage ? { storage, persistent } : getSafeStorage()
  const finalStorage = storage ?? safe.storage
  const finalPersistent = storage ? persistent : safe.persistent

  const recoveryNotices: RecoveryNotice[] = []

  const keys = {
    quizzes: STORAGE_PREFIX + 'quizzes',
    leads: STORAGE_PREFIX + 'leads',
    attempts: STORAGE_PREFIX + 'attempts',
    settings: STORAGE_PREFIX + 'settings',
    activeQuizId: STORAGE_PREFIX + 'activeQuizId',
    profile: STORAGE_PREFIX + 'profile',
    adminPasscode: STORAGE_PREFIX + 'adminPasscode',
    seeded: STORAGE_PREFIX + 'seeded',
  }

  function backupKey(name: string) {
    return BACKUP_PREFIX + name + ':' + now()
  }

  function noteRecovery(key: string, savedBackupKey: string) {
    const name = key.slice(STORAGE_PREFIX.length)
    if (recoveryNotices.some((notice) => notice.key === key && notice.backupKey === savedBackupKey)) return
    recoveryNotices.push({
      key,
      label: labelForDataName(name),
      backupKey: savedBackupKey,
      at: now(),
    })
  }

  function isQuotaError(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const e = err as { name?: string; code?: number }
    return e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014
  }

  function isUnavailable(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false
    const e = err as { name?: string }
    return e.name === 'SecurityError' || e.name === 'TypeError'
  }

  function allKeys(): string[] {
    const result: string[] = []
    try {
      const length = finalStorage.length
      if (typeof length === 'number' && typeof finalStorage.key === 'function') {
        for (let index = 0; index < length; index++) {
          const key = finalStorage.key(index)
          if (key) result.push(key)
        }
      }
    } catch {
      // Không liệt kê được khoá: coi như rỗng để app vẫn chạy.
    }
    return result
  }

  function readJson<T>(key: string, schema: z.ZodType<T>, fallback: T): StorageResult<T> {
    let raw: string | null
    try {
      raw = finalStorage.getItem(key)
    } catch {
      return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: MSG.storageRead } }
    }
    if (raw === null) return { ok: true, data: fallback }
    try {
      const parsed = JSON.parse(raw)
      const data = schema.parse(parsed)
      return { ok: true, data }
    } catch {
      const savedBackupKey = backupKey(key.slice(STORAGE_PREFIX.length))
      try {
        finalStorage.setItem(savedBackupKey, raw)
      } catch {
        // Không sao lưu được (hết chỗ / chặn lưu trữ) vẫn phải chạy tiếp.
      }
      noteRecovery(key, savedBackupKey)
      try {
        finalStorage.setItem(key, JSON.stringify(fallback))
      } catch {
        // ignore write failure
      }
      return { ok: true, data: fallback, warning: 'RECOVERED_CORRUPT' }
    }
  }

  function writeJson(key: string, value: unknown): StorageResult<void> {
    try {
      finalStorage.setItem(key, JSON.stringify(value))
      return { ok: true, data: undefined }
    } catch (err) {
      if (isQuotaError(err)) {
        return { ok: false, error: { code: 'QUOTA_EXCEEDED', message: MSG.storageQuota } }
      }
      if (isUnavailable(err)) {
        return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: MSG.storageUnavailable } }
      }
      return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: MSG.storageWrite } }
    }
  }

  function getSeeded(): boolean {
    try {
      return finalStorage.getItem(keys.seeded) === 'true'
    } catch {
      return false
    }
  }

  function setSeeded() {
    try {
      finalStorage.setItem(keys.seeded, 'true')
    } catch {
      // ignore
    }
  }

  function getQuizzes(): StorageResult<Quiz[]> {
    return readJson(keys.quizzes, z.array(QuizSchema), [])
  }

  function getQuiz(id: string): StorageResult<Quiz> {
    const r = getQuizzes()
    if (!r.ok) return r
    const found = r.data.find((q) => q.id === id)
    if (!found) return { ok: false, error: { code: 'NOT_FOUND', message: MSG.quizNotFound } }
    return { ok: true, data: found }
  }

  function saveQuiz(quiz: Quiz): StorageResult<void> {
    const parsed = QuizSchema.safeParse(quiz)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: MSG.quizInvalid } }
    }
    const r = getQuizzes()
    if (!r.ok) return r
    const list = r.data.filter((q) => q.id !== quiz.id)
    list.push(parsed.data)
    const w = writeJson(keys.quizzes, list)
    if (!w.ok) return w
    return { ok: true, data: undefined }
  }

  function deleteQuiz(id: string): StorageResult<void> {
    const r = getQuizzes()
    if (!r.ok) return r
    const list = r.data.filter((q) => q.id !== id)
    const w = writeJson(keys.quizzes, list)
    if (!w.ok) return w
    const activeR = getActiveQuizId()
    if (activeR.ok && activeR.data === id) {
      const newest = list.slice().sort((a, b) => b.createdAt - a.createdAt)[0]
      const setR = setActiveQuizId(newest ? newest.id : null)
      if (!setR.ok) return setR
    }
    return { ok: true, data: undefined }
  }

  function getActiveQuizId(): StorageResult<string | null> {
    return readJson(keys.activeQuizId, z.string().nullable(), null)
  }

  function setActiveQuizId(id: string | null): StorageResult<void> {
    return writeJson(keys.activeQuizId, id)
  }

  function getLeads(): StorageResult<Lead[]> {
    return readJson(keys.leads, z.array(LeadSchema), [])
  }

  function saveLead(lead: Lead): StorageResult<{ outcome: 'created' | 'improved' | 'kept_existing' }> {
    const parsed = LeadSchema.safeParse(lead)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: MSG.leadInvalid } }
    }
    const r = getLeads()
    if (!r.ok) return r
    const { leads, outcome } = upsertLeadByPhone(r.data, parsed.data)
    const w = writeJson(keys.leads, leads)
    if (!w.ok) return w
    return { ok: true, data: { outcome } }
  }

  function deleteLead(id: string): StorageResult<void> {
    const r = getLeads()
    if (!r.ok) return r
    const list = r.data.filter((l) => l.id !== id)
    return writeJson(keys.leads, list)
  }

  function clearLeads(): StorageResult<void> {
    return writeJson(keys.leads, [])
  }

  function getAttempts(): StorageResult<Attempt[]> {
    return readJson(keys.attempts, z.array(AttemptSchema), [])
  }

  function saveAttempt(attempt: Attempt): StorageResult<void> {
    const parsed = AttemptSchema.safeParse(attempt)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: MSG.attemptInvalid } }
    }
    const r = getAttempts()
    if (!r.ok) return r
    const list = [...r.data, parsed.data].slice(-200)
    return writeJson(keys.attempts, list)
  }

  function getSettings(): StorageResult<Settings> {
    return readJson(keys.settings, SettingsSchema, DEFAULT_SETTINGS)
  }

  function saveSettings(settings: Settings): StorageResult<void> {
    const parsed = SettingsSchema.safeParse(settings)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: MSG.settingsInvalid } }
    }
    return writeJson(keys.settings, parsed.data)
  }

  function getProfile(): StorageResult<Profile | null> {
    return readJson(keys.profile, ProfileSchema.nullable(), null)
  }

  function saveProfile(profile: Profile): StorageResult<void> {
    const parsed = ProfileSchema.safeParse(profile)
    if (!parsed.success) {
      return { ok: false, error: { code: 'INVALID', message: MSG.profileInvalid } }
    }
    return writeJson(keys.profile, parsed.data)
  }

  function getAdminPasscode(): string | null {
    try {
      return finalStorage.getItem(keys.adminPasscode)
    } catch {
      return null
    }
  }

  function saveAdminPasscode(passcode: string): StorageResult<void> {
    try {
      finalStorage.setItem(keys.adminPasscode, passcode)
      return { ok: true, data: undefined }
    } catch {
      return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: MSG.storageWrite } }
    }
  }

  function listBackups(): BackupInfo[] {
    return allKeys()
      .filter((key) => key.startsWith(BACKUP_PREFIX))
      .map((key) => {
        const rest = key.slice(BACKUP_PREFIX.length)
        const lastColon = rest.lastIndexOf(':')
        const name = lastColon === -1 ? rest : rest.slice(0, lastColon)
        const parsedAt = Number.parseInt(lastColon === -1 ? '' : rest.slice(lastColon + 1), 10)
        let raw = ''
        try {
          raw = finalStorage.getItem(key) ?? ''
        } catch {
          raw = ''
        }
        return {
          key,
          name,
          label: labelForDataName(name),
          at: Number.isFinite(parsedAt) ? parsedAt : 0,
          bytes: raw.length * 2,
        }
      })
      .sort((a, b) => b.at - a.at)
  }

  function getBackupContent(key: string): string | null {
    if (!key.startsWith(BACKUP_PREFIX)) return null
    try {
      return finalStorage.getItem(key)
    } catch {
      return null
    }
  }

  function deleteBackup(key: string): StorageResult<void> {
    if (!key.startsWith(BACKUP_PREFIX)) {
      return { ok: false, error: { code: 'INVALID', message: MSG.backupInvalid } }
    }
    try {
      finalStorage.removeItem(key)
      return { ok: true, data: undefined }
    } catch {
      return { ok: false, error: { code: 'STORAGE_UNAVAILABLE', message: MSG.storageWrite } }
    }
  }

  function clearBackups(): StorageResult<void> {
    for (const backup of listBackups()) {
      const r = deleteBackup(backup.key)
      if (!r.ok) return r
    }
    return { ok: true, data: undefined }
  }

  function getStorageUsage(): StorageUsage {
    const quizKeys = allKeys().filter((key) => key.startsWith(STORAGE_PREFIX))
    let bytes = 0
    for (const key of quizKeys) {
      try {
        bytes += (finalStorage.getItem(key)?.length ?? 0) * 2
      } catch {
        // ignore
      }
    }
    return { bytes, keys: quizKeys.length }
  }

  function restoreSeedQuiz(): StorageResult<Quiz> {
    const timestamp = now()
    const quiz: Quiz = {
      ...SEED_QUIZ,
      id: createId(),
      questions: SEED_QUIZ.questions.map((question) => ({ ...question, id: createId() })),
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const saved = saveQuiz(quiz)
    if (!saved.ok) return saved
    const active = getActiveQuizId()
    if (!active.ok) return active
    if (active.data === null) {
      const setR = setActiveQuizId(quiz.id)
      if (!setR.ok) return setR
    }
    return { ok: true, data: quiz }
  }

  function getRecoveryNotices(): RecoveryNotice[] {
    return recoveryNotices.slice()
  }

  /** Đọc mọi khoá một lần để phát hiện dữ liệu hỏng ngay khi tải app. */
  function scanAll(): RecoveryNotice[] {
    getQuizzes()
    getLeads()
    getAttempts()
    getSettings()
    getActiveQuizId()
    getProfile()
    return getRecoveryNotices()
  }

  function ensureSeed(): StorageResult<void> {
    if (getSeeded()) return { ok: true, data: undefined }
    const r = getQuizzes()
    if (!r.ok) return r
    if (r.data.length > 0) {
      setSeeded()
      return { ok: true, data: undefined }
    }
    const seed = { ...SEED_QUIZ, createdAt: now(), updatedAt: now() }
    const saveR = saveQuiz(seed)
    if (!saveR.ok) return saveR
    const activeR = getActiveQuizId()
    if (activeR.ok && activeR.data === null) {
      const setR = setActiveQuizId(seed.id)
      if (!setR.ok) return setR
    }
    setSeeded()
    return { ok: true, data: undefined }
  }

  const repo = {
    getQuizzes,
    getQuiz,
    saveQuiz,
    deleteQuiz,
    getActiveQuizId,
    setActiveQuizId,
    getLeads,
    saveLead,
    deleteLead,
    clearLeads,
    getAttempts,
    saveAttempt,
    getSettings,
    saveSettings,
    getProfile,
    saveProfile,
    getAdminPasscode,
    saveAdminPasscode,
    ensureSeed,
    getRecoveryNotices,
    scanAll,
    listBackups,
    getBackupContent,
    deleteBackup,
    clearBackups,
    getStorageUsage,
    restoreSeedQuiz,
    persistent: finalPersistent,
  }
  return repo
}
