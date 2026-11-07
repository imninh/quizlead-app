import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { OpponentIcon } from '../../components/OpponentIcon'
import { RaceCharacter } from '../../components/RaceCharacter'
import { opponentLabel } from '../../domain/raceLabels'
import { opponentTotals, racePosition, type RaceOpponent } from '../../domain/race'
import { MSG } from '../../domain/messages'
import type { Character } from '../../domain/schemas'

function Lane({
  label,
  shortLabel,
  score,
  position,
  avatar,
  answered,
}: {
  label: string
  shortLabel: string
  score: number
  position: number
  avatar: ReactNode
  answered?: string
}) {
  const reduced = useReducedMotion()
  return (
    <div className="flex min-h-9 items-center gap-1 sm:min-h-12">
      <span className="w-14 shrink-0 truncate font-display text-[11px] leading-none sm:w-20">
        <span className="sm:hidden">{shortLabel}</span>
        <span className="hidden sm:inline">{label}</span>
      </span>
      <div className="relative h-9 min-w-0 flex-1 overflow-hidden rounded-full border border-ink/25 bg-white/80 sm:h-12">
        <div className="absolute inset-x-2 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-ink/10" />
        <div className="absolute inset-y-1 right-2 w-0.5 bg-ink/60" aria-hidden="true" />
        <motion.div
          className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
          animate={{ left: `${Math.max(0.03, position) * 100}%` }}
          transition={{ duration: reduced ? 0 : 0.45, ease: 'easeOut' }}
        >
          {avatar}
        </motion.div>
        {answered ? (
          <span className="absolute inset-y-0 right-1 flex items-center rounded bg-sun/90 px-1 text-[11px] font-semibold text-ink">
            {answered}
          </span>
        ) : null}
        <span className="sr-only">{label}: {score.toLocaleString('vi-VN')} điểm</span>
      </div>
    </div>
  )
}

export function RaceTrack({
  playerCharacter,
  playerScore,
  opponent,
  opponentAnswered,
  answeredCount = 5,
}: {
  playerCharacter: Character
  playerScore: number
  opponent: RaceOpponent | null
  opponentAnswered: boolean
  answeredCount?: number
}) {
  if (!opponent) return null
  const totals = opponentTotals(opponent.answers.slice(0, Math.max(0, Math.min(5, answeredCount))))
  const label = opponentLabel(opponent.kind, opponent.model)

  return (
    <div className="mb-3 space-y-0.5 rounded-[16px_20px_14px_22px] border-2 border-ink bg-paper/90 p-1.5 shadow-sticker" aria-label="Đường đua">
      <Lane
        label="Bạn"
        shortLabel="Bạn"
        score={playerScore}
        position={racePosition(playerScore)}
        avatar={<RaceCharacter character={playerCharacter} className="h-9 w-9 sm:h-12 sm:w-12" />}
      />
      <Lane
        label={label}
        shortLabel={MSG.opponentLabels[opponent.kind]}
        score={totals.totalScore}
        position={racePosition(totals.totalScore)}
        avatar={<OpponentIcon kind={opponent.kind} size={32} />}
        answered={opponentAnswered ? MSG.opponentAnswered(label) : undefined}
      />
    </div>
  )
}
