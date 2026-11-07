/* oxlint-disable-file react(purity), react-hooks(exhaustive-deps) */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Check } from 'lucide-react'
import { useRepo } from '../../hooks/useRepo'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { CharacterImage } from '../../components/CharacterImage'
import { CountUp } from '../../components/CountUp'
import { Doodle } from '../../components/Doodle'
import { HandNote } from '../../components/HandNote'
import { MucDoodle } from '../../components/MucDoodle'
import { OpponentIcon } from '../../components/OpponentIcon'
import { PosterBackdrop } from '../../components/PosterBackdrop'
import { opponentLabel } from '../../domain/raceLabels'
import { raceResultAsset } from '../../components/raceAssets'
import { StickerCard } from '../../components/StickerCard'
import { normalizeName, normalizePhone, getNameError, getPhoneError } from '../../domain/validation'
import { buildShareText } from '../../domain/share'
import { isInAppBrowser } from '../../domain/browser'
import { copyText } from '../../services/clipboard'
import { createId } from '../../domain/id'
import { loadPendingResult, loadOnlineAttemptToken, clearOnlineAttemptToken } from '../../services/session'
import { saveOnlineEntryId, saveOnlineEntry, scorePayload, submitOnlineScore } from '../../services/onlineClient'
import { MSG } from '../../domain/messages'
import type { Lead } from '../../domain/schemas'

export default function ResultPage() {
  const { attemptId } = useParams()
  const repo = useRepo()
  const navigate = useNavigate()
  const toast = useToast()
  const reduced = useReducedMotion()

  const attemptsResult = repo.getAttempts()
  const savedAttempt = attemptId && attemptsResult.ok
    ? attemptsResult.data.find((a) => a.id === attemptId) ?? null
    : null
  const pendingAttempt = !savedAttempt && attemptId ? loadPendingResult(attemptId) : null
  const attempt = savedAttempt ?? pendingAttempt
  const attemptNotSaved = !savedAttempt && !!pendingAttempt

  const quizResult = attempt ? repo.getQuiz(attempt.quizId) : null
  const quiz = quizResult && quizResult.ok ? quizResult.data : null
  const leadsResult = repo.getLeads()
  const existingLead = leadsResult.ok ? leadsResult.data.find((l) => l.attemptId === attempt?.id) ?? null : null
  const settingsResult = repo.getSettings()
  const settings = settingsResult.ok ? settingsResult.data : { fanpageName: 'QuizLead', giftDescription: 'Quà', fanpageUrl: '' }
  const profileResult = repo.getProfile()
  const profile = profileResult.ok ? profileResult.data : null
  const playerCharacter = profile?.character ?? 'mi'

  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [errors, setErrors] = useState<{ name?: string; phone?: string; consent?: string }>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [leadId, setLeadId] = useState<string | null>(null)
  const [showReview, setShowReview] = useState(false)
  const [fallbackText, setFallbackText] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [onlineStatus, setOnlineStatus] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [lastLead, setLastLead] = useState<Lead | null>(null)
  const fallbackRef = useRef<HTMLTextAreaElement>(null)
  const savingRef = useRef(false)

  useEffect(() => {
    if (fallbackText && fallbackRef.current) {
      fallbackRef.current.focus()
      fallbackRef.current.select()
    }
  }, [fallbackText])

  if (!attempt) {
    return (
      <div className="max-w-xl mx-auto space-y-4 text-center">
        <CharacterImage name="muc-tangled" className="mx-auto h-40 w-auto" width={240} height={240} sizes="160px" />
        <p className="text-lg font-semibold">Không tìm thấy kết quả.</p>
        <Button onClick={() => navigate('/')}>Về trang đầu</Button>
      </div>
    )
  }

  const validate = () => {
    const next: { name?: string; phone?: string; consent?: string } = {}
    const ne = getNameError(name)
    if (ne) next.name = ne
    const pe = getPhoneError(phone)
    if (pe) next.phone = pe
    if (!consent) next.consent = 'Bạn cần đồng ý để nhận quà'
    setErrors((prev) =>
      prev.name === next.name && prev.phone === next.phone && prev.consent === next.consent ? prev : next,
    )
    return Object.keys(next).length === 0
  }

  const submit = async () => {
    if (savingRef.current) return
    if (!validate()) return
    savingRef.current = true
    setSaving(true)
    const lead = {
      id: createId(),
      quizId: attempt.quizId,
      attemptId: attempt.id,
      name: normalizeName(name),
      phone: normalizePhone(phone),
      consent: true as const,
      totalScore: attempt.totalScore,
      correctCount: attempt.correctCount,
      totalTimeMs: attempt.totalTimeMs,
      // oxlint-disable-next-line react/purity
      createdAt: Date.now(),
      character: playerCharacter,
      raceResult: attempt.raceResult,
      opponentKind: attempt.opponent?.kind,
    }
    const r = repo.saveLead(lead)
    setSaving(false)
    savingRef.current = false
    if (!r.ok) {
      setMessage(r.error.message)
      return
    }
    setLeadId(lead.id)
    setLastLead(lead)
    if (attempt.online) void sendOnline(lead)
    if (r.data.outcome === 'created') setMessage(`Đã ghi nhận! ${settings.fanpageName} sẽ liên hệ trao quà.`)
    else if (r.data.outcome === 'improved') setMessage('Bạn đã tham gia trước đó, hệ thống đã cập nhật kết quả tốt hơn.')
    else setMessage('Bạn đã tham gia, hệ thống giữ kết quả tốt nhất trước đó.')
  }

  const sendOnline = async (lead: Lead) => {
    const token = loadOnlineAttemptToken()
    if (!token) {
      setOnlineStatus('failed')
      return
    }
    setOnlineStatus('sending')
    try {
      const result = await submitOnlineScore(
        scorePayload({
          token,
          name: lead.name,
          character: lead.character ?? playerCharacter,
          phone: lead.phone,
          answers: attempt.answers,
          opponent: attempt.opponent
            ? {
                kind: attempt.opponent.kind,
                model: attempt.opponent.model,
                totalScore: attempt.opponent.totalScore,
                totalTimeMs: attempt.opponent.totalTimeMs,
              }
            : null,
        }),
      )
      saveOnlineEntryId(result.entry.entryId)
      saveOnlineEntry(result.entry)
      clearOnlineAttemptToken()
      setOnlineStatus('sent')
    } catch {
      setOnlineStatus('failed')
    }
  }

  const share = async () => {
    const text = buildShareText({
      score: attempt.totalScore,
      correctCount: attempt.correctCount,
      totalTimeMs: attempt.totalTimeMs,
      quizTitle: quiz?.title ?? 'Quiz',
      fanpageName: settings.fanpageName,
      appUrl: window.location.origin,
      race: attempt.raceResult && attempt.opponent
        ? { result: attempt.raceResult, opponentLabel: opponentLabel(attempt.opponent.kind, attempt.opponent.model) }
        : undefined,
    })
    const res = await copyText(text)
    if (res.ok) {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      toast.show('Đã copy! Mở Facebook và dán vào bài viết nhé')
    } else setFallbackText(text)
  }

  const inAppBrowser = isInAppBrowser(navigator.userAgent)
  const instantScore = !!reduced || import.meta.env.MODE === 'test'
  const raceOpponent = attempt.opponent
  const raceOutcome = attempt.raceResult
  const raceLabel = raceOpponent ? opponentLabel(raceOpponent.kind, raceOpponent.model) : ''
  const raceDiff = raceOpponent ? Math.abs(attempt.totalScore - raceOpponent.totalScore) : 0
  const raceVisual = raceOutcome ? raceResultAsset(playerCharacter, raceOutcome) : null
  const posterWord = raceOutcome === 'win' ? 'WIN!' : raceOutcome === 'lose' ? 'GG!' : 'QUIZ!'
  const shareButton = (
    <Button variant="secondary" onClick={share}>
      {copied ? <Check className="size-5" aria-hidden="true" data-icon="copied" /> : null}
      Copy kết quả để đăng Facebook
    </Button>
  )
  const facebookButton = (
    <a
      href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.origin)}`}
      target="_blank"
      rel="noopener noreferrer"
      className="hover-lift inline-flex min-h-[44px] items-center justify-center rounded-[16px_20px_14px_22px] border-2 border-ink bg-white px-4 py-3 text-ink shadow-sticker"
    >
      Mở Facebook
    </a>
  )

  return (
    <div className="relative mx-auto max-w-6xl overflow-hidden lg:flex lg:min-h-[calc(100svh-7rem)] lg:max-w-none lg:flex-col lg:justify-center">
      <PosterBackdrop word={posterWord} align="right" showTapes={false} />
      <Doodle kind="star" size={48} color="var(--color-sun)" className="absolute -left-2 top-2 hidden opacity-70 lg:block" />
      <Doodle kind="swirl" size={70} color="var(--color-bubble)" className="absolute -right-2 bottom-16 hidden opacity-50 lg:block" />

      <div className="result-wide relative z-10">
        <div className="result-wide__score">
          <StickerCard tone="sun" className="result-score-card relative overflow-hidden text-center lg:flex lg:h-full lg:flex-col lg:justify-center lg:p-8">
            <div className="absolute -right-4 -top-4 opacity-30">
              <Doodle kind="burst" size={110} color="var(--color-alert)" />
            </div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-ink/60">Điểm của bạn</p>
            <div className="relative">
              <svg viewBox="0 0 200 60" className="mx-auto block h-auto w-40 lg:w-52" fill="none" aria-hidden="true">
                <path d="M16 58a84 54 0 0 1 168 0" stroke="var(--color-ink)" strokeOpacity="0.12" strokeWidth="7" strokeLinecap="round" />
                <motion.path
                  d="M16 58a84 54 0 0 1 168 0"
                  stroke="var(--color-alert)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: reduced ? 0.12 : 1.2, ease: 'easeOut' }}
                />
              </svg>
              <CountUp
                value={attempt.totalScore}
                reducedMotion={instantScore}
                className="result-score-number relative block font-display leading-none text-[clamp(3.8rem,15vw,7rem)] lg:text-[clamp(5rem,8vw,8rem)]"
              />
            </div>
            <div className="text-lg font-semibold">điểm</div>
            <div className="text-sm font-medium">{attempt.correctCount}/5 câu đúng · {Math.round(attempt.totalTimeMs / 1000)} giây</div>
          </StickerCard>
        </div>

        <div className={raceOpponent && raceOutcome ? 'result-wide__race' : 'result-wide__race hidden lg:block'}>
          {raceOpponent && raceOutcome ? (
            <StickerCard
              tone={raceOutcome === 'win' ? 'mint' : raceOutcome === 'lose' ? 'alert' : 'paper'}
              className="space-y-2 text-center lg:flex lg:h-full lg:flex-col lg:justify-center lg:space-y-4"
            >
              <div className="flex items-center justify-center gap-2">
                {raceVisual?.kind === 'doodle'
                  ? <MucDoodle className="h-24 w-24 lg:h-32 lg:w-32" />
                  : <CharacterImage name={raceVisual?.name ?? 'mi-oops'} className="h-24 w-auto object-contain lg:h-32" width={160} height={160} sizes="(min-width: 1024px) 128px, 96px" />}
                <div className="text-left">
                  <p className="font-display text-2xl">
                    {raceOutcome === 'win' ? MSG.raceWin : raceOutcome === 'lose' ? MSG.raceLose : MSG.raceDraw}
                  </p>
                  <p className="text-sm font-medium">{MSG.raceOutcome(raceOutcome, raceLabel, raceDiff)}</p>
                </div>
                <OpponentIcon kind={raceOpponent.kind} size={40} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border-2 border-ink bg-white/70 p-2">
                  <div className="font-display text-lg">Bạn</div>
                  <div className="font-bold">{attempt.totalScore.toLocaleString('vi-VN')} điểm</div>
                </div>
                <div className="rounded-xl border-2 border-ink bg-white/70 p-2">
                  <div className="font-display text-lg">{raceLabel}</div>
                  <div className="font-bold">{raceOpponent.totalScore.toLocaleString('vi-VN')} điểm</div>
                </div>
              </div>
            </StickerCard>
          ) : (
            <div className="hidden lg:block lg:h-full">
              <StickerCard tone="paper" className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <p className="font-display text-3xl">Đường đua</p>
                <p className="text-sm text-ink/70">Lượt này chưa có đối thủ.</p>
                <Link to={`/leaderboard/${attempt.quizId}`} className="inline-flex min-h-[44px] items-center font-semibold underline decoration-2 underline-offset-4">
                  Xem bảng xếp hạng
                </Link>
              </StickerCard>
            </div>
          )}
        </div>

        <div className="result-wide__char">
          <div className="relative mx-auto max-w-[280px] lg:max-w-[380px]">
            <div className="absolute inset-x-8 bottom-1 h-6 rounded-[50%] bg-ink/10 blur-sm" aria-hidden="true" />
            <CharacterImage name="mi-phone-cool" priority sizes="(min-width: 1024px) 254px, (min-width: 640px) 139px, 117px" className="result-char-img relative mx-auto h-44 w-auto object-contain sm:h-52 lg:h-[380px]" />
          </div>
        </div>

        <div className="result-wide__review space-y-4">
          {attemptNotSaved ? (
            <div role="alert" className="rounded-[18px_22px_16px_24px] border-2 border-ink bg-alert px-4 py-3 text-white shadow-sticker">
              {MSG.attemptNotSaved}
            </div>
          ) : null}

          <div>
            <button className="inline-flex min-h-[44px] items-center font-semibold underline decoration-2 underline-offset-4" onClick={() => setShowReview((v) => !v)}>
              {showReview ? 'Ẩn' : 'Xem lại đáp án'}
            </button>
            {showReview ? (
              <div className="mt-3 space-y-3">
                {attempt.answers.map((a, i) => {
                  const question = quiz?.questions[i]
                  return (
                    <Card key={a.questionId} className="space-y-1">
                      <p className="font-medium">{question?.text}</p>
                      <p className="text-sm">Bạn chọn: {a.selectedIndex === null ? 'Hết giờ' : question?.options[a.selectedIndex]}</p>
                      <p className="text-sm">Đáp án đúng: {question?.options[question.correctIndex]}</p>
                      {question?.explanation ? <p className="text-sm text-ink/70">{question.explanation}</p> : null}
                    </Card>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="result-wide__form space-y-4">
          {leadId || existingLead ? (
            <StickerCard tone="mint" className="space-y-3 text-center">
              <div className="flex justify-center">
                <HandNote rotate="3deg">{MSG.handThanks}</HandNote>
              </div>
              <p className="text-lg font-semibold">Bạn đã gửi thông tin nhận quà ✓</p>
              {attempt.online ? (
                <div className="space-y-1 text-sm">
                  {onlineStatus === 'sending' ? <p>Đang gửi lên bảng xếp hạng chung…</p> : null}
                  {onlineStatus === 'sent' ? <p>Đã gửi lên bảng xếp hạng chung.</p> : null}
                  {onlineStatus === 'failed' ? (
                    <>
                      <p>Chưa gửi được lên bảng xếp hạng chung.</p>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (lastLead) void sendOnline(lastLead)
                        }}
                      >
                        Gửi lại
                      </Button>
                    </>
                  ) : null}
                </div>
              ) : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                <Link
                  to={`/leaderboard/${attempt.quizId}?highlight=${leadId ?? existingLead?.id}`}
                  className="inline-flex min-h-[44px] items-center font-semibold underline decoration-2 underline-offset-4"
                >
                  Xem bảng xếp hạng
                </Link>
                {settings.fanpageUrl ? (
                  <a href={settings.fanpageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center font-semibold underline decoration-2 underline-offset-4">
                    Theo dõi fanpage
                  </a>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                {shareButton}
                {facebookButton}
              </div>
              <CharacterImage name="mi-skate-wave" className="mx-auto h-32 w-auto object-contain" width={240} height={240} sizes="128px" />
            </StickerCard>
          ) : (
            <StickerCard tone="paper" className="space-y-3">
              <h2 className="font-display text-3xl">Nhận quà</h2>
              <div>
                <label htmlFor="lead-name" className="block text-sm font-semibold">Họ và tên</label>
                <input
                  id="lead-name"
                  className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2 focus-visible:outline-4 focus-visible:outline-cobalt"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  inputMode="text"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'lead-name-error' : undefined}
                />
                {errors.name ? <p id="lead-name-error" className="mt-1 text-sm text-alert">{errors.name}</p> : null}
              </div>
              <div>
                <label htmlFor="lead-phone" className="block text-sm font-semibold">Số điện thoại</label>
                <input
                  id="lead-phone"
                  className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2 focus-visible:outline-4 focus-visible:outline-cobalt"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  aria-invalid={!!errors.phone}
                  aria-describedby={errors.phone ? 'lead-phone-error' : undefined}
                />
                {errors.phone ? <p id="lead-phone-error" className="mt-1 text-sm text-alert">{errors.phone}</p> : null}
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  id="lead-consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-1 size-5 accent-cobalt"
                  aria-labelledby="lead-consent-label"
                />
                <span id="lead-consent-label">Tôi đồng ý cho {settings.fanpageName} lưu tên và SĐT để liên hệ trao quà</span>
              </label>
              {errors.consent ? <p className="text-sm text-alert">{errors.consent}</p> : null}
              {attempt.online ? (
                <p className="text-xs text-ink/60">
                  Tên và SĐT đã che (vd 09******78) sẽ hiện trên bảng xếp hạng chung. SĐT đầy đủ không được lưu trên máy chủ.
                </p>
              ) : null}
              {message ? <p className="text-sm font-semibold">{message}</p> : null}
              {settings.fanpageUrl ? (
                <a href={settings.fanpageUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-sm font-semibold underline decoration-2 underline-offset-4">
                  Theo dõi fanpage
                </a>
              ) : null}
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button className="min-h-[56px] text-lg" onClick={submit} disabled={saving}>
                  {saving ? 'Đang gửi...' : 'Gửi thông tin'}
                </Button>
                <Link to={`/leaderboard/${attempt.quizId}${leadId ? `?highlight=${leadId}` : ''}`} className="inline-flex min-h-[44px] items-center font-semibold underline decoration-2 underline-offset-4">
                  {leadId ? 'Xem bảng xếp hạng' : 'Bỏ qua, xem bảng xếp hạng'}
                </Link>
                {shareButton}
                {facebookButton}
              </div>
            </StickerCard>
          )}

          {inAppBrowser ? <p className="text-xs text-ink/60">{MSG.inAppBrowserHint}</p> : null}

          {fallbackText ? (
            <Card className="space-y-2">
              <p className="text-sm">{MSG.copyManual}</p>
              <textarea
                ref={fallbackRef}
                className="w-full rounded-xl border-2 border-ink p-2"
                rows={6}
                value={fallbackText}
                readOnly
                aria-label="Nội dung cần copy"
              />
              <p className="text-xs text-ink/60">{MSG.copyManualHint}</p>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
