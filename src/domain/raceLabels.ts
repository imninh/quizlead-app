import type { OpponentKind } from './schemas.ts'
import { MSG } from './messages.ts'

/** Nhãn đối thủ phía người chơi. Không bao giờ ghép tên model (R-103/104/105). */
export function opponentLabel(kind: OpponentKind, _model?: string): string {
  return MSG.opponentLabels[kind]
}
