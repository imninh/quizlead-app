/* oxlint-disable-file react/purity, react-hooks/exhaustive-deps */
import { useCallback, useEffect, useReducer, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useRepo } from '../../hooks/useRepo'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { EmptyState } from '../../components/EmptyState'
import { AnswerCard } from '../../components/AnswerCard'
import { Celebration } from '../../components/Celebration'
import { CharacterImage } from '../../components/CharacterImage'
import { Doodle } from '../../components/Doodle'
import { HandNote } from '../../components/HandNote'
import { ProgressDots } from '../../components/ProgressDots'
import { SceneWipe } from '../../components/SceneWipe'
import { StickerCard } from '../../components/StickerCard'
import { TimerPill } from '../../components/TimerPill'
import { OpponentIntro } from './OpponentIntro'
import { RaceLobby } from './RaceLobby'
import { RaceTrack } from './RaceTrack'
import {
  gameReducer,
  createInitialState,
  remainingMs,
  type GameState,
} from '../../domain/game'
import { summarizeAttempt } from '../../domain/scoring'
import { createId } from '../../domain/id'
import { QUESTION_TIME_MS } from '../../domain/constants'
import {
  ghostToAnswers,
  mulberry32,
  opponentAnsweredAt,
  opponentTotals,
  pickOpponent,
  raceResult,
  seedFromString,
  simulateBot,
  type RaceOpponent,
} from '../../domain/race'
import { loadSession, saveSession, clearSession, savePendingResult, saveOnlineAttemptToken } from '../../services/session'
import { startOnlineAttempt } from '../../services/onlineClient'
import type { Attempt, Profile, Quiz } from '../../domain/schemas'
import { MSG } from '../../domain/messages'

function initGame(quiz: Quiz): GameState {
  const loaded = loadSession()
  if (loaded && loaded.quizId === quiz.id && loaded.state.status !== 'finished') {
    return loaded.state
  }
  return createInitialState()
}

export default function PlayPage({
  quizOverride,
  online = false,
}: {
  quizOverride?: Quiz
  online?: boolean
} = {}) {
  const { quizId } = useParams()
  const repo = useRepo()
  const navigate = useNavigate()
  const toast = useToast()
  const reduced = useReducedMotion()

  // Chốt bản quiz tại thời điểm vào trang: tab khác xoá quiz cũng không đổi câu giữa chừng.
  const [quiz] = useState<Quiz | null>(() => {
    if (quizOverride) return quizOverride
    if (!quizId) return null
    const result = repo.getQuiz(quizId)
    return result.ok ? result.data : null
  })
  const [now, setNow] = useState(() => Date.now())

  const [state, dispatch] = useReducer(gameReducer, quiz, (initialQuiz) => {
    if (!initialQuiz) return createInitialState()
    return initGame(initialQuiz)
  })
  const [pendingRace, setPendingRace] = useState<{ opponent: RaceOpponent; attemptId: string } | null>(null)
  const [showIntro, setShowIntro] = useState(false)
  const profileResult = repo.getProfile()
  const profile = profileResult.ok ? profileResult.data : null
  const playerCharacter = profile?.character ?? 'mi'

  const startRace = (nextProfile: Profile) => {
    if (!quiz) return
    const attemptId = createId()
    const rng = mulberry32(seedFromString(attemptId))
    const hasGhost = !!quiz.aiGhost && quiz.aiGhost.answers.length === 5
    const debugAllowed =
      import.meta.env.DEV ||
      import.meta.env.MODE === 'test' ||
      import.meta.env.VITE_RACE_DEBUG === '1'
    const forced = debugAllowed ? new URLSearchParams(window.location.search).get('opponent') : null
    const forcedKind = forced === 'ai' || forced === 'cheetah' || forced === 'rabbit' || forced === 'turtle'
      ? forced
      : null
    const kind = forcedKind === 'ai'
      ? (hasGhost ? 'ai' : pickOpponent(rng, hasGhost))
      : forcedKind ?? pickOpponent(rng, hasGhost)
    const opponent: RaceOpponent =
      kind === 'ai' && quiz.aiGhost
        ? { kind, model: quiz.aiGhost.model, answers: ghostToAnswers(quiz, quiz.aiGhost) }
        : { kind, answers: simulateBot(kind, quiz, rng) }
    void nextProfile
    if (online) {
      void startOnlineAttempt(quiz.id)
        .then((result) => saveOnlineAttemptToken(result.token))
        .catch(() => {
          // Không lấy được token thì vẫn chơi; chỉ không gửi điểm online được.
        })
    }
    setPendingRace({ opponent, attemptId })
    setShowIntro(true)
  }

  const finishIntro = useCallback(() => {
    if (!pendingRace || !quiz) return
    setShowIntro(false)
    dispatch({
      type: 'START',
      quiz,
      now: Date.now(),
      attemptId: pendingRace.attemptId,
      opponent: pendingRace.opponent,
    })
  }, [pendingRace, quiz])

  useEffect(() => {
    if (!quiz) return
    const id = window.setInterval(() => {
      const time = Date.now()
      setNow(time)
      dispatch({ type: 'TICK', now: time })
    }, 200)
    return () => window.clearInterval(id)
  }, [quiz])

  useEffect(() => {
    if (state.status !== 'finished' && quiz) saveSession(state)
    if (state.status === 'finished') clearSession()
  }, [state, quiz])

  useEffect(() => {
    if (state.status !== 'question') return
    const handler = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const map: Record<string, number> = { '1': 0, 'a': 0, '2': 1, 'b': 1, '3': 2, 'c': 2, '4': 3, 'd': 3 }
      if (map[key] !== undefined) dispatch({ type: 'ANSWER', index: map[key], now: Date.now() })
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [state.status]) // oxlint-disable-line react-hooks/exhaustive-deps

  // oxlint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.status !== 'finished' || !state.quiz) return
    const summary = summarizeAttempt(state.answers)
    const opponentScore = state.opponent ? opponentTotals(state.opponent.answers) : null
    const attempt: Attempt = {
      id: state.attemptId ?? createId(),
      quizId: state.quiz.id,
      answers: state.answers,
      totalScore: summary.totalScore,
      correctCount: summary.correctCount,
      totalTimeMs: summary.totalTimeMs,
      finishedAt: Date.now(),
      opponent: state.opponent && opponentScore
        ? {
            kind: state.opponent.kind,
            model: state.opponent.model,
            totalScore: opponentScore.totalScore,
            totalTimeMs: opponentScore.totalTimeMs,
          }
        : undefined,
      raceResult: state.opponent && opponentScore
        ? raceResult(
            { totalScore: summary.totalScore, totalTimeMs: summary.totalTimeMs },
            opponentScore,
          )
        : undefined,
      online,
    }
    const r = repo.saveAttempt(attempt)
    if (!r.ok) {
      // Vẫn hiện điểm ở trang kết quả dù không ghi được localStorage.
      savePendingResult(attempt)
      toast.show(MSG.attemptNotSaved)
    }
    navigate(`/result/${attempt.id}`, { replace: true })
  }, [state.status]) // oxlint-disable-line react-hooks/exhaustive-deps

  if (!quiz) {
    return (
      <EmptyState
        title="Không tìm thấy quiz"
        actionLabel="Về trang đầu"
        onAction={() => navigate('/')}
        note={MSG.handCheer}
      />
    )
  }

  if (state.status === 'idle') {
    if (showIntro && pendingRace) {
      return <OpponentIntro kind={pendingRace.opponent.kind} model={pendingRace.opponent.model} onDone={finishIntro} />
    }
    return <RaceLobby onStart={startRace} />
  }

  const q = quiz.questions[state.questionIndex]!
  const answered = state.answers.length > state.questionIndex
  const last = state.answers[state.answers.length - 1]
  const revealActive = state.revealUntil !== null && now < state.revealUntil
  // Trong cửa sổ reveal, đồng hồ đứng ở 30 giây (R-37); điểm vẫn tính từ cuối reveal.
  const timer = revealActive ? 30 : Math.ceil(remainingMs(state, now) / 1000)
  const isTimeout = last?.selectedIndex === null
  const feedbackKind = last?.isCorrect ? 'correct' : isTimeout ? 'timeout' : 'wrong'
  const playerScore = state.answers.reduce((sum, answer) => sum + answer.points, 0)
  const answeredCount = state.answers.length
  const questionStartedAt = state.deadline !== null ? state.deadline - QUESTION_TIME_MS : now
  const opponentAnswered =
    state.status === 'question' &&
    !revealActive &&
    opponentAnsweredAt(state.opponent?.answers[state.questionIndex], Math.max(0, now - questionStartedAt))

  if (state.status === 'feedback') {
    const tone =
      feedbackKind === 'correct'
        ? 'bg-mint/40'
        : feedbackKind === 'timeout'
          ? 'bg-cobalt/20'
          : 'bg-alert/20'
    const character =
      feedbackKind === 'correct' ? 'mi-celebrate' : feedbackKind === 'timeout' ? 'mi-timeout' : 'mi-oops'
    const title = feedbackKind === 'correct' ? MSG.correct : feedbackKind === 'timeout' ? MSG.timeout : MSG.wrong

    return (
      <div className="quiz-feedback relative mx-auto max-w-4xl overflow-hidden rounded-[24px_18px_28px_16px] border-2 border-ink p-4 sm:p-8">
        <motion.div
          aria-hidden="true"
          className={`absolute inset-0 z-0 ${tone}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: reduced ? 0.12 : 0.28 }}
        />
        <Celebration active={feedbackKind === 'correct'} reduced={!!reduced} />
        <Doodle
          kind={feedbackKind === 'correct' ? 'burst' : 'swirl'}
          size={80}
          color={feedbackKind === 'correct' ? 'var(--color-mint)' : 'var(--color-alert)'}
          className="absolute -right-4 -top-4 z-0 opacity-60"
        />
        <motion.div
          className="relative z-10 space-y-4 text-center"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={
            feedbackKind === 'wrong' && !reduced
              ? { opacity: 1, y: 0, x: [0, -7, 7, -3, 3, 0] }
              : { opacity: 1, y: 0, x: 0 }
          }
          transition={{ duration: reduced ? 0.15 : 0.42, ease: 'easeOut' }}
        >
          <div className="mx-auto max-w-2xl text-left">
            <RaceTrack
              playerCharacter={playerCharacter}
              playerScore={playerScore}
              opponent={state.opponent}
              answeredCount={answeredCount}
              opponentAnswered={false}
            />
          </div>
          <h2 className="font-display text-[clamp(2.4rem,9vw,4rem)] leading-none">
            <span className="display-tilt">{title}</span>
          </h2>
          {last ? <p className="font-display text-3xl text-ink">+{last.points}</p> : null}
          <StickerCard tone="white" className="text-left">
            <p className="text-xs font-bold uppercase tracking-wide text-ink/60">Đáp án đúng</p>
            <p className="text-lg font-semibold">{q.options[q.correctIndex]}</p>
            {q.explanation ? <p className="mt-1 text-sm text-ink/75">{q.explanation}</p> : null}
          </StickerCard>
          <p className="text-xs font-medium text-ink/60">
            Tự chuyển sau {Math.max(0, Math.ceil(remainingMs(state, now) / 1000))}s
          </p>
          <Button className="min-h-[56px] w-full text-lg sm:w-auto" onClick={() => dispatch({ type: 'NEXT', now: Date.now() })}>
            {MSG.nextQuestion}
          </Button>
        </motion.div>
        <motion.div
          className="feedback-char relative z-10 mt-4 flex justify-center"
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotate: -6 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ type: reduced ? 'tween' : 'spring', stiffness: 220, damping: 16, duration: reduced ? 0.15 : undefined }}
        >
          <CharacterImage
            name={character}
            sizes="(min-width: 640px) 208px, 160px"
            className="pointer-events-none h-40 w-auto object-contain sm:h-52"
          />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <ProgressDots current={state.questionIndex + 1} total={5} />
        <TimerPill seconds={timer} total={30} />
      </div>

      <RaceTrack
        playerCharacter={playerCharacter}
        playerScore={playerScore}
        opponent={state.opponent}
        answeredCount={answeredCount}
        opponentAnswered={opponentAnswered}
      />

      <div className="quiz-stage relative">
        <motion.div
          key={state.questionIndex}
          className="quiz-stage__question relative z-10"
          initial={reduced ? { opacity: 0 } : { opacity: 0, x: -26 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: reduced ? 0.15 : 0.5, ease: 'easeOut' }}
        >
          <StickerCard tone="paper" className="text-center sm:text-left">
            <HandNote rotate="-3deg" className="mb-2 hidden sm:inline-block">
              {MSG.handThink}
            </HandNote>
            <p className="answer-text text-lg font-semibold leading-relaxed sm:text-xl">{q.text}</p>
          </StickerCard>
        </motion.div>

        <div className="quiz-stage__answers relative z-10 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {q.options.map((opt, i) => (
            <motion.div
              key={`${state.questionIndex}-${i}`}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 18, rotate: i % 2 === 0 ? -2 : 2 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: reduced ? 0.15 : 0.35, delay: reduced ? 0 : i * 0.06, ease: 'easeOut' }}
            >
              <AnswerCard
                index={i as 0 | 1 | 2 | 3}
                state={revealActive || answered || state.status !== 'question' ? 'disabled' : 'idle'}
                onClick={() => dispatch({ type: 'ANSWER', index: i, now: Date.now() })}
              >
                {opt}
              </AnswerCard>
            </motion.div>
          ))}
        </div>

        <div className="quiz-stage__character relative mt-2 hidden sm:block">
          <div className="absolute inset-x-6 bottom-0 h-6 rounded-[50%] bg-ink/10 blur-sm" aria-hidden="true" />
          <CharacterImage
            name="mi-point-up"
            priority
            sizes="(min-width: 1024px) 213px, 171px"
            className="relative mx-auto h-64 w-auto object-contain lg:h-80"
          />
        </div>
      </div>

      <SceneWipe sceneKey={state.questionIndex} />
    </div>
  )
}
