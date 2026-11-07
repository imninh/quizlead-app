/* oxlint-disable-file react/set-state-in-effect, react-hooks/exhaustive-deps, react/purity */
import { useEffect, useRef, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useRepo } from '../../hooks/useRepo'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { TextField } from '../../components/TextField'
import { TextArea } from '../../components/TextField'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { CharacterImage } from '../../components/CharacterImage'
import { validateQuiz } from '../../domain/validation'
import type { Question, Quiz } from '../../domain/schemas'
import { createId } from '../../domain/id'
import { generateQuiz, MockProvider, runGhost } from '../../services/aiClient'
import { SEED_QUIZ } from '../../domain/seed'
import { MSG } from '../../domain/messages'

const OPTION_COLORS = ['bg-sun', 'bg-bubble', 'bg-sky', 'bg-mint']
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
const MOCK_LABEL = 'Bản demo vòng loại - Dữ liệu mô phỏng AI'

type QForm = {
  text: string
  options: [string, string, string, string]
  correctIndex: 0 | 1 | 2 | 3
  explanation: string
}

type AiPending = {
  questions: QForm[]
  mode: 'real' | 'mock'
  model?: string
}

function emptyQuestion(): QForm {
  return { text: '', options: ['', '', '', ''], correctIndex: 0, explanation: '' }
}

function makeEmpty(): QForm[] {
  return Array.from({ length: 5 }, () => emptyQuestion())
}

export default function AdminQuizEditPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const quizId = isNew ? createId() : id!
  const repo = useRepo()
  const navigate = useNavigate()
  const toast = useToast()
  const online = useOnlineStatus()

  const [title, setTitle] = useState('')
  const [topic, setTopic] = useState('')
  const [questions, setQuestions] = useState<QForm[]>(makeEmpty())
  const [modified, setModified] = useState<boolean[]>(Array(5).fill(false))
  const [aiUsed, setAiUsed] = useState(false)
  const [aiOriginal, setAiOriginal] = useState('')
  const [aiTopic, setAiTopic] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiFailed, setAiFailed] = useState(false)
  const [aiMode, setAiMode] = useState<'real' | 'mock' | null>(null)
  const [aiModel, setAiModel] = useState('')
  const [aiPending, setAiPending] = useState<AiPending | null>(null)
  const [retryAfter, setRetryAfter] = useState(0)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [titleTouched, setTitleTouched] = useState(false)
  const [saveAttempted, setSaveAttempted] = useState(false)
  const [initialSnapshot, setInitialSnapshot] = useState('')
  const [clearOpen, setClearOpen] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const allowNavigation = useRef(false)

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !allowNavigation.current && dirtyState() && currentLocation.pathname !== nextLocation.pathname,
  )

  function dirtyState(): boolean {
    const snap = JSON.stringify({ title, topic, questions })
    return snap !== initialSnapshot
  }

  const dirty = dirtyState()

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (isNew) {
      // oxlint-disable-next-line react/set-state-in-effect
      setInitialSnapshot(JSON.stringify({ title: '', topic: '', questions: makeEmpty() }))
      return
    }
    const r = repo.getQuiz(quizId)
    if (r.ok) {
      const q = r.data
      setTitle(q.title)
      setTopic(q.topic ?? '')
      const qs = q.questions.map((x) => ({
        text: x.text,
        options: [...x.options] as [string, string, string, string],
        correctIndex: x.correctIndex,
        explanation: x.explanation ?? '',
      }))
      // pad to 5
      while (qs.length < 5) qs.push(emptyQuestion())
      setQuestions(qs)
      setInitialSnapshot(JSON.stringify({ title: q.title, topic: q.topic ?? '', questions: qs }))
    }
  }, [isNew, quizId, repo])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (retryAfter <= 0) return
    const timer = window.setTimeout(() => setRetryAfter((value) => Math.max(0, value - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [retryAfter])

  const errors = validateQuiz({ title, questions })
  const totalErrors =
    (errors.title ? 1 : 0) +
    (errors.questionsCount ? 1 : 0) +
    (errors.questions?.reduce((s, q) => s + Object.keys(q).length, 0) ?? 0)

  const qErrors = (i: number) => errors.questions?.[i] ?? {}

  const updateQuestion = (i: number, patch: Partial<QForm>) => {
    setQuestions((prev) => {
      const next = [...prev]
      const current = next[i]!
      next[i] = { ...current, ...patch }
      return next
    })
    if (aiUsed) {
      setModified((prev) => {
        const next = [...prev]
        next[i] = true
        return next
      })
    }
  }

  const fillAi = (qs: QForm[], mode: 'real' | 'mock', model?: string) => {
    setQuestions(qs)
    setAiUsed(true)
    setAiMode(mode)
    setAiModel(model ?? '')
    setAiOriginal(JSON.stringify(qs))
    setModified(Array(5).fill(false))
    setAiFailed(false)
    toast.show(mode === 'mock' ? MOCK_LABEL : 'Đã tạo 5 câu hỏi bằng AI')
  }

  const applyAiResult = (qs: QForm[], mode: 'real' | 'mock', model?: string) => {
    const hasContent = questions.some((q) => q.text.trim())
    if (hasContent) {
      setAiPending({ questions: qs, mode, model })
      return
    }
    fillAi(qs, mode, model)
  }

  const requestAi = async () => {
    if (!online || retryAfter > 0) return
    setAiError(null)
    setAiFailed(false)
    const controller = new AbortController()
    abortRef.current = controller
    setAiLoading(true)
    const result = await generateQuiz(
      { topic: aiTopic, difficulty: aiDifficulty, language: 'vi' },
      { signal: controller.signal },
    )
    if (controller.signal.aborted) {
      abortRef.current = null
      setAiLoading(false)
      return
    }
    abortRef.current = null
    setAiLoading(false)
    if (!result.ok) {
      setAiError(result.message)
      setAiFailed(result.code !== 'INAPPROPRIATE' && result.code !== 'INVALID_INPUT')
      setRetryAfter(result.code === 'RATE_LIMIT' ? result.retryAfter ?? 60 : 0)
      return
    }
    setRetryAfter(0)
    const qs: QForm[] = result.questions.map((q) => ({
      text: q.text,
      options: [...q.options] as [string, string, string, string],
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? '',
    }))
    applyAiResult(qs, result.mode, result.model)
  }

  const requestMockFallback = async () => {
    setAiError(null)
    setAiFailed(false)
    setAiLoading(true)
    const controller = new AbortController()
    abortRef.current = controller
    const result = await new MockProvider().generateQuiz(
      { topic: aiTopic, difficulty: aiDifficulty, language: 'vi' },
      controller.signal,
    )
    if (controller.signal.aborted) {
      abortRef.current = null
      setAiLoading(false)
      return
    }
    abortRef.current = null
    setAiLoading(false)
    if (!result.ok) {
      setAiError(result.message)
      return
    }
    const qs: QForm[] = result.questions.map((q) => ({
      text: q.text,
      options: [...q.options] as [string, string, string, string],
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? '',
    }))
    applyAiResult(qs, 'mock')
  }

  const confirmAi = () => {
    if (aiPending) fillAi(aiPending.questions, aiPending.mode, aiPending.model)
    setAiPending(null)
  }

  const cancelAiPending = () => {
    setAiPending(null)
  }

  const cancelAiRequest = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setAiLoading(false)
    setAiError(null)
    setAiFailed(false)
  }

  const save = () => {
    setSaveAttempted(true)
    if (totalErrors > 0) return
    const now = Date.now()
    const quizQuestions: Question[] = questions.map((q) => ({
      id: createId(),
      text: q.text.trim(),
      options: q.options.map((o) => o.trim()) as [string, string, string, string],
      correctIndex: q.correctIndex as 0 | 1 | 2 | 3,
      explanation: q.explanation.trim() || undefined,
    }))
    const edited = aiUsed && JSON.stringify(questions) !== aiOriginal
    const source: 'manual' | 'ai' | 'mixed' = !aiUsed ? 'manual' : edited ? 'mixed' : 'ai'
    const existing = isNew ? null : repo.getQuiz(quizId)
    const questionsChanged =
      !!existing &&
      existing.ok &&
      JSON.stringify(existing.data.questions) !== JSON.stringify(quizQuestions)
    const quiz: Quiz = {
      id: quizId,
      title: title.trim(),
      topic: topic.trim() || undefined,
      questions: quizQuestions,
      source,
      aiGhost: existing && existing.ok && !questionsChanged ? existing.data.aiGhost : undefined,
      publishedVersion: existing && existing.ok ? existing.data.publishedVersion : undefined,
      publishedAt: existing && existing.ok ? existing.data.publishedAt : undefined,
      createdAt: existing && existing.ok ? existing.data.createdAt : now,
      updatedAt: now,
    }
    const r = repo.saveQuiz(quiz)
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    const active = repo.getActiveQuizId()
    if (active.ok && active.data === null) repo.setActiveQuizId(quiz.id)
    runGhostInBackground(quiz)
    setInitialSnapshot(JSON.stringify({ title: quiz.title, topic: quiz.topic ?? '', questions }))
    allowNavigation.current = true
    toast.show('Đã lưu quiz')
    navigate('/admin')
  }

  const runGhostInBackground = (quiz: Quiz) => {
    if (import.meta.env.VITE_AI_MODE === 'mock') return
    void runGhost(quiz)
      .then((ghost) => {
        const current = repo.getQuiz(quiz.id)
        if (!current.ok || JSON.stringify(current.data.questions) !== JSON.stringify(quiz.questions)) return
        const saved = repo.saveQuiz({ ...current.data, aiGhost: ghost })
        if (saved.ok) window.dispatchEvent(new Event('quizlead:changed'))
      })
      .catch(() => {
        // Lỗi bóng ma không được chặn việc lưu quiz.
      })
  }

  const clearAll = () => {
    setQuestions(makeEmpty())
    setTitle('')
    setTopic('')
    setAiUsed(false)
    setAiOriginal('')
    setAiMode(null)
    setAiModel('')
    setAiError(null)
    setAiFailed(false)
    setModified(Array(5).fill(false))
    setClearOpen(false)
  }

  const fillSample = () => {
    const q = SEED_QUIZ.questions.map((x) => ({
      text: x.text,
      options: [...x.options] as [string, string, string, string],
      correctIndex: x.correctIndex,
      explanation: x.explanation ?? '',
    }))
    while (q.length < 5) q.push(emptyQuestion())
    setQuestions(q)
    setTopic('Digital Marketing')
    setTitle('Quiz mẫu')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl">{isNew ? 'Tạo quiz' : 'Sửa quiz'}</h1>
        <div className="text-sm text-ink/60">Còn {totalErrors} lỗi</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card className="space-y-3">
            <TextField
              label="Tiêu đề"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTitleTouched(true)}
              error={titleTouched || saveAttempted ? errors.title : undefined}
              count={{ current: title.trim().length, max: 100 }}
            />
            <TextField label="Chủ đề (tuỳ chọn)" value={topic} onChange={(e) => setTopic(e.target.value)} />
          </Card>

          <Card className="space-y-3">
            <h2 className="font-display text-xl">AI gợi ý câu hỏi</h2>
            {aiUsed && aiMode === 'mock' ? <p className="text-xs text-ink/60">{MOCK_LABEL}</p> : null}
            {aiUsed && aiMode === 'real' && aiModel ? <p className="text-xs text-ink/60">Tạo bởi AI · {aiModel}</p> : null}
            {!aiUsed ? <p className="text-xs text-ink/60">AI thật (OpenRouter · Claude Haiku). Kết quả cần được kiểm tra trước khi lưu.</p> : null}
            <TextField label="Chủ đề" value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} />
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button key={d} className={`px-3 py-1 rounded-xl border-2 ${aiDifficulty === d ? 'bg-sun' : 'bg-white'}`} onClick={() => setAiDifficulty(d)}>
                  {d === 'easy' ? 'Dễ' : d === 'medium' ? 'Vừa' : 'Khó'}
                </button>
              ))}
            </div>
            {!online ? <p className="text-sm">{MSG.offlineAi}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={requestAi} disabled={aiLoading || !online || retryAfter > 0}>
                {aiLoading ? 'AI đang soạn câu hỏi…' : retryAfter > 0 ? MSG.retryRateLimit(retryAfter) : 'Gợi ý AI'}
              </Button>
              {aiLoading ? <Button variant="secondary" onClick={cancelAiRequest}>Huỷ</Button> : null}
              {!online ? <Button variant="secondary" onClick={requestMockFallback}>Dùng bộ câu hỏi mẫu (Mock)</Button> : null}
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-3 rounded-[16px_20px_14px_22px] border-2 border-ink/15 bg-white/70 p-2">
                <CharacterImage name="mi-ai-thinking" className="h-24 w-auto object-contain" width={200} height={200} sizes="96px" />
                <p className="text-sm font-medium">Mi đang soạn và tự soát câu hỏi… (khoảng 15 giây)</p>
              </div>
            ) : null}
            {aiError ? (
              <div className="space-y-2">
                <p className="text-alert text-sm">{aiError}</p>
                {aiFailed && !aiLoading ? (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={requestAi} disabled={!online || retryAfter > 0}>
                      {retryAfter > 0 ? MSG.retryRateLimit(retryAfter) : 'Thử lại'}
                    </Button>
                    <Button variant="secondary" onClick={requestMockFallback}>Dùng bộ câu hỏi mẫu (Mock)</Button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          {questions.map((q, i) => {
            const qe = qErrors(i)
            return (
              <Card key={i} className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Câu {i + 1}</h3>
                  {aiUsed ? <span className="text-xs px-2 py-1 rounded-full bg-sky/30">{modified[i] ? 'Đã chỉnh sửa' : 'AI gợi ý, hãy kiểm tra lại'}</span> : null}
                </div>
                <TextArea label="Câu hỏi" value={q.text} onChange={(e) => updateQuestion(i, { text: e.target.value })} error={qe.text} count={{ current: q.text.trim().length, max: 300 }} rows={3} />
                {q.options.map((opt, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${i}`}
                      aria-label={`Chọn đáp án đúng cho câu ${i + 1} là ${String.fromCharCode(65 + j)}`}
                      checked={q.correctIndex === j}
                      onChange={() => updateQuestion(i, { correctIndex: j as 0 | 1 | 2 | 3 })}
                    />
                    <textarea
                      rows={2}
                      aria-label={`Đáp án ${String.fromCharCode(65 + j)} câu ${i + 1}`}
                      className={`min-h-[44px] flex-1 resize-y rounded-xl border-2 border-ink px-3 py-2 leading-snug ${OPTION_COLORS[j]}`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...q.options] as [string, string, string, string]
                        next[j] = e.target.value
                        updateQuestion(i, { options: next })
                      }}
                      placeholder={`Đáp án ${String.fromCharCode(65 + j)}`}
                    />
                  </div>
                ))}
                {qe.options ? <p className="text-alert text-sm">{qe.options.filter(Boolean).join(', ')}</p> : null}
                {qe.correctIndex ? <p className="text-alert text-sm">{qe.correctIndex}</p> : null}
                <TextArea label="Giải thích (tuỳ chọn)" value={q.explanation} onChange={(e) => updateQuestion(i, { explanation: e.target.value })} count={{ current: q.explanation.trim().length, max: 200 }} rows={2} />
              </Card>
            )
          })}

          <div className="flex gap-3">
            <Button onClick={save}>Lưu</Button>
            <Button variant="secondary" onClick={fillSample}>Điền mẫu</Button>
            <Button variant="ghost" onClick={() => setClearOpen(true)}>Xoá trắng</Button>
          </div>
        </div>

        <div className="hidden lg:block">
          <Card className="space-y-3 sticky top-24">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl">Xem trước</h2>
              <span className="text-sm font-semibold">Câu {previewIndex + 1}/5</span>
            </div>
            <p className="font-medium">{questions[previewIndex]?.text || 'Câu hỏi...'}</p>
            <div className="grid grid-cols-2 gap-2">
              {questions[previewIndex]?.options.map((o, i) => (
                <div key={i} className={`rounded-xl border-2 border-ink p-2 text-sm leading-snug ${OPTION_COLORS[i]}`}>
                  {o || `Đáp án ${String.fromCharCode(65 + i)}`}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" className="flex-1" disabled={previewIndex === 0} onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}>
                Trước
              </Button>
              <Button variant="secondary" className="flex-1" disabled={previewIndex === 4} onClick={() => setPreviewIndex((index) => Math.min(4, index + 1))}>
                Sau
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={!!aiPending}
        title="Thay câu hỏi?"
        message="Thay 5 câu hiện tại bằng câu hỏi AI gợi ý?"
        onConfirm={confirmAi}
        onCancel={cancelAiPending}
      />

      <ConfirmDialog
        open={clearOpen}
        title="Xoá trắng?"
        message="Toàn bộ nội dung đang nhập sẽ bị xoá."
        danger
        confirmLabel="Xoá trắng"
        onConfirm={clearAll}
        onCancel={() => setClearOpen(false)}
      />

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        title="Rời trang?"
        message="Thay đổi chưa lưu sẽ mất."
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      />
    </div>
  )
}