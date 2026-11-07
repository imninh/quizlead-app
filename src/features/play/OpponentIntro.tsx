import { useEffect } from 'react'
import { HandNote } from '../../components/HandNote'
import { OpponentIcon } from '../../components/OpponentIcon'
import { opponentLabel } from '../../domain/raceLabels'
import { StickerCard } from '../../components/StickerCard'
import { MSG } from '../../domain/messages'
import type { OpponentKind } from '../../domain/schemas'

export const OPPONENT_INTRO_MS = 2000

export function OpponentIntro({
  kind,
  onDone,
}: {
  kind: OpponentKind
  /** Vẫn nhận model trong dữ liệu nhưng không hiển thị phía người chơi. */
  model?: string
  onDone: () => void
}) {
  useEffect(() => {
    const timeout = window.setTimeout(onDone, OPPONENT_INTRO_MS)
    return () => window.clearTimeout(timeout)
  }, [onDone])

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-lg py-8 text-center">
      <HandNote rotate="2deg">Chuẩn bị…</HandNote>
      <h1 className="mt-4 font-display text-[clamp(2rem,8vw,3.4rem)] leading-none">
        <span className="display-tilt">{MSG.raceOpponentTitle}</span>
      </h1>
      <StickerCard tone="sky" className="mt-5 flex flex-col items-center gap-3">
        <OpponentIcon kind={kind} size={96} />
        <p className="text-2xl font-bold">{opponentLabel(kind)}</p>
        {kind === 'ai' ? <p className="text-sm font-semibold text-ink/70">{MSG.bossHint}</p> : null}
        <p className="text-sm">Đối thủ đang vào vạch xuất phát…</p>
      </StickerCard>
    </div>
  )
}
