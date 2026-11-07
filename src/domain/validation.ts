import { MSG } from './messages.ts'

export type QuestionErrors = {
  text?: string
  options?: (string | undefined)[]
  correctIndex?: string
}

export type QuizErrors = {
  title?: string
  questions?: QuestionErrors[]
  questionsCount?: string
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').normalize('NFC')
}

export function validateName(name: string): boolean {
  const n = normalizeName(name)
  if (n.length < 2 || n.length > 50) return false
  return /^[\p{L}\p{M}\s]+$/u.test(n)
}

export function getNameError(name: string): string | undefined {
  const n = normalizeName(name)
  if (n.length < 2 || n.length > 50) return MSG.nameLength
  if (!/^[\p{L}\p{M}\s]+$/u.test(n)) return MSG.nameChars
  return undefined
}

export function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s.()-]/g, '')
  if (p.startsWith('+84')) p = '0' + p.slice(3)
  else if (p.startsWith('84') && p.length >= 10) p = '0' + p.slice(2)
  return p
}

export function validatePhone(phone: string): boolean {
  const p = normalizePhone(phone)
  return /^0(3|5|7|8|9)\d{8}$/.test(p)
}

export function getPhoneError(phone: string): string | undefined {
  const p = normalizePhone(phone)
  if (!/^0(3|5|7|8|9)\d{8}$/.test(p)) return MSG.phoneInvalid
  return undefined
}

export function maskPhone(phone: string): string {
  const p = normalizePhone(phone)
  if (p.length !== 10) return p
  return p.slice(0, 2) + '*'.repeat(6) + p.slice(-2)
}

export function validateQuestion(q: {
  text?: string
  options?: string[]
  correctIndex?: number | null
}): QuestionErrors {
  const errors: QuestionErrors = {}
  const text = (q.text ?? '').trim()
  if (text.length < 5 || text.length > 300) errors.text = MSG.questionLength

  const opts = Array.isArray(q.options) ? q.options : []
  const optionErrors: (string | undefined)[] = []
  let hasOptionError = false
  for (let i = 0; i < 4; i++) {
    const raw = opts[i]
    if (raw === undefined) {
      optionErrors.push(MSG.optionEmpty)
      hasOptionError = true
      continue
    }
    const t = raw.trim()
    if (t.length < 1) {
      optionErrors.push(MSG.optionEmpty)
      hasOptionError = true
      continue
    }
    if (t.length > 150) {
      optionErrors.push(MSG.optionLength)
      hasOptionError = true
      continue
    }
    let dup = false
    for (let j = 0; j < i; j++) {
      const other = opts[j]
      if (other !== undefined && other.trim().toLowerCase() === t.toLowerCase()) {
        dup = true
        break
      }
    }
    if (dup) {
      optionErrors.push(MSG.optionDuplicate)
      hasOptionError = true
    } else {
      optionErrors.push(undefined)
    }
  }
  if (opts.length !== 4) {
    while (optionErrors.length < 4) optionErrors.push(MSG.optionEmpty)
    hasOptionError = true
  }
  if (hasOptionError) errors.options = optionErrors

  const ci = q.correctIndex
  if (typeof ci !== 'number' || ci < 0 || ci > 3 || ci >= opts.length) {
    errors.correctIndex = MSG.correctIndex
  }
  return errors
}

export function validateQuiz(quiz: {
  title?: string
  questions?: Array<{ text?: string; options?: string[]; correctIndex?: number | null }>
}): QuizErrors {
  const errors: QuizErrors = {}
  const title = (quiz.title ?? '').trim()
  if (title.length < 3 || title.length > 100) errors.title = MSG.titleLength

  const qs = Array.isArray(quiz.questions) ? quiz.questions : []
  if (qs.length !== 5) {
    errors.questionsCount = MSG.quizQuestionCount
  }
  const qErrors: QuestionErrors[] = qs.map((q) => validateQuestion(q))
  if (qErrors.some((e) => Object.keys(e).length > 0)) {
    errors.questions = qErrors
  }
  if (qs.length !== 5 && !errors.questions) {
    errors.questions = qErrors
  }
  return errors
}