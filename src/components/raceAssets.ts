import { resolveAsset } from './assetResolver'
import type { Character, RaceResult } from '../domain/schemas.ts'

export type RaceResultVisual =
  | { kind: 'image'; name: string }
  | { kind: 'doodle'; character: 'muc' }

const WIN_ASSET: Record<Character, string> = {
  mi: 'mi-celebrate',
  bin: 'bin-win',
  muc: 'muc-win',
}

const LOSE_ASSET: Record<Character, string> = {
  mi: 'mi-oops',
  bin: 'bin-lose',
  muc: 'muc-lose',
}

/**
 * Ảnh/doodle cho thẻ kết quả đua. Mực thua/hoà dùng doodle (chưa có ảnh 11);
 * các trường hợp còn lại chỉ trả file có thật trong manifest, không trỏ file thiếu.
 */
export function raceResultAsset(character: Character, outcome: RaceResult): RaceResultVisual {
  if (character === 'muc' && outcome !== 'win') return { kind: 'doodle', character: 'muc' }

  const preferred = outcome === 'win' ? WIN_ASSET[character] : LOSE_ASSET[character]
  const resolved = resolveAsset(preferred) ?? resolveAsset(outcome === 'win' ? 'mi-celebrate' : 'mi-oops')
  if (resolved) return { kind: 'image', name: resolved }
  return { kind: 'doodle', character: 'muc' }
}
