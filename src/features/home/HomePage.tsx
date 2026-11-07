import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useRepo } from '../../hooks/useRepo'
import { Button } from '../../components/Button'
import { CharacterImage } from '../../components/CharacterImage'
import { FloatingDoodle } from '../../components/FloatingDoodle'
import { HandNote } from '../../components/HandNote'
import { PosterBackdrop, PosterMarquee } from '../../components/PosterBackdrop'
import { StickerCard } from '../../components/StickerCard'
import { EmptyState } from '../../components/EmptyState'
import { BrushStroke } from '../../components/BrushStroke'
import { MSG } from '../../domain/messages'
import { Gift, ListChecks, Timer, type LucideIcon } from 'lucide-react'

/** Ô thông tin kiểu sticker: icon nét đậm + giá trị to + nhãn, chấm halftone ở góc. */
function StatSticker({
  tone,
  tilt,
  icon: Icon,
  value,
  label,
}: {
  tone: 'sun' | 'sky' | 'bubble'
  tilt: string
  icon: LucideIcon
  value: string
  label: string
}) {
  return (
    <div className="h-full" style={{ transform: `rotate(${tilt})` }}>
      <StickerCard className="stat-sticker relative h-full overflow-hidden !px-2 !py-3 text-center" tone={tone}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-2 -top-2 h-14 w-14 opacity-25"
          style={{
            backgroundImage: 'radial-gradient(var(--color-ink) 1.2px, transparent 1.6px)',
            backgroundSize: '6px 6px',
            maskImage: 'radial-gradient(circle at top right, #000 20%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(circle at top right, #000 20%, transparent 70%)',
          }}
        />
        <div className="relative flex flex-col items-center gap-1">
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full border-2 border-ink bg-white shadow-[2px_2px_0_var(--color-ink)] sm:size-9"
          >
            <Icon className="size-4 sm:size-5" strokeWidth={2.5} />
          </span>
          <div className="font-display text-2xl leading-none sm:text-3xl">{value}</div>
          <div className="text-xs font-semibold sm:text-sm">{label}</div>
        </div>
      </StickerCard>
    </div>
  )
}

export default function HomePage() {
  const repo = useRepo()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const activeResult = repo.getActiveQuizId()
  const quizId = useMemo(() => (activeResult.ok ? activeResult.data : null), [activeResult])

  const quiz = quizId ? repo.getQuiz(quizId) : null
  const quizData = quiz && quiz.ok ? quiz.data : null
  const settingsResult = repo.getSettings()
  const settings = settingsResult.ok ? settingsResult.data : { fanpageName: 'QuizLead', giftDescription: 'Quà', fanpageUrl: '' }

  if (!quizData) {
    return (
      <EmptyState
        title="Chưa có quiz"
        actionLabel="Sang trang quản trị"
        onAction={() => navigate('/admin')}
        note={MSG.handCheer}
      />
    )
  }

  return (
    <div className="home-hero relative mx-auto max-w-6xl overflow-hidden lg:flex lg:min-h-[calc(100svh-7rem)] lg:max-w-none lg:flex-col lg:justify-center lg:py-6">
      <PosterBackdrop word="QUIZ!" align="right" />
      <FloatingDoodle kind="star" size={54} color="var(--color-bubble)" className="absolute left-0 top-4 hidden opacity-80 sm:block lg:hidden" />
      <FloatingDoodle kind="swirl" size={70} color="var(--color-cobalt)" className="absolute bottom-10 right-0 hidden opacity-60 md:block" delay={0.6} />
      <FloatingDoodle kind="arrow" size={64} color="var(--color-alert)" className="absolute -left-24 bottom-16 hidden -rotate-12 opacity-70 min-[1440px]:block" delay={1.1} />

      <div className="relative z-10 grid items-center gap-6 md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:gap-8 lg:gap-14">
        <div className="home-hero-copy order-2 space-y-5 text-center md:order-1 md:text-left">
          <div className="relative z-20 flex justify-center md:justify-start lg:hidden">
            <HandNote rotate="-4deg">{MSG.handCheer}</HandNote>
          </div>

          <div className="relative inline-block">
            <HandNote rotate="-5deg" className="absolute -bottom-9 right-2 z-20 hidden lg:inline-block">
              {MSG.handCheer}
            </HandNote>
            <BrushStroke color="var(--color-sun)" className="-inset-x-4 bottom-1 h-5 w-[calc(100%+2rem)] opacity-90" />
            <h1 className="home-hero-title relative text-balance font-display leading-[0.95] text-ink text-[clamp(2.4rem,9vw,4.8rem)] lg:text-[clamp(4.8rem,6vw,6.5rem)]">
              <span className="display-tilt">{quizData.title}</span>
            </h1>
          </div>

          {quizData.topic ? <p className="text-lg font-semibold text-ink/80">{quizData.topic}</p> : null}

          <p className="mx-auto max-w-xl text-base md:mx-0">
            {MSG.homeLead} <strong>{settings.fanpageName}</strong>.
          </p>

          <div className="grid grid-cols-3 gap-2 px-1 sm:gap-3">
            <StatSticker tone="sun" tilt="-1deg" icon={ListChecks} value="5" label="câu hỏi" />
            <StatSticker tone="sky" tilt="0.8deg" icon={Timer} value="~2" label="phút" />
            <StatSticker tone="bubble" tilt="-0.8deg" icon={Gift} value="Có quà" label="chờ bạn" />
          </div>

          <p className="text-sm font-medium text-ink/80">
            Phần thưởng: <strong>{settings.giftDescription || 'Có quà'}</strong>
          </p>

          <p className="text-sm font-medium">Đúng càng nhanh, điểm càng cao: tối đa 1.000 điểm/câu.</p>

          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row md:justify-start">
            <Button className="min-h-[56px] text-lg" onClick={() => navigate(`/play/${quizData.id}`)}>
              Bắt đầu chơi
            </Button>
            <Link to={`/leaderboard/${quizData.id}`} className="inline-flex min-h-[44px] items-center self-center font-semibold underline decoration-2 underline-offset-4">
              Xem bảng xếp hạng
            </Link>
            {settings.fanpageUrl ? (
              <a
                href={settings.fanpageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center self-center font-semibold underline decoration-2 underline-offset-4"
              >
                Theo dõi fanpage
              </a>
            ) : null}
          </div>
        </div>

        <motion.div
          className="relative order-1 mx-auto w-full max-w-[280px] sm:max-w-[360px] md:order-2 md:max-w-none"
          animate={reduced ? undefined : { y: [0, -8, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="absolute inset-x-4 bottom-2 h-8 rounded-[50%] bg-ink/15 blur-md" aria-hidden="true" />
          <CharacterImage
            name="mi-hero-jump"
            priority
            sizes="(min-width: 1440px) 600px, (min-width: 1024px) 360px, (min-width: 768px) 40vw, 280px"
            className="home-hero-img relative mx-auto h-auto w-full max-h-[46vh] object-contain drop-shadow-[6px_10px_0_rgba(28,27,34,0.18)] md:max-h-[64vh] lg:h-[70vh] lg:max-h-[900px] lg:w-auto"
          />
          <HandNote rotate="6deg" className="absolute -right-1 top-4 hidden sm:inline-block">
            {MSG.handGo}
          </HandNote>
        </motion.div>
      </div>
      <PosterMarquee reducedMotion={!!reduced} />
    </div>
  )
}
