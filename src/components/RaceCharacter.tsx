import { CharacterImage } from './CharacterImage'
import { MucDoodle } from './MucDoodle'
import { resolveAsset } from './assetResolver'
import type { Character } from '../domain/schemas'

const RUN_ASSET: Record<Character, string> = {
  mi: 'mi-run',
  bin: 'bin-run',
  muc: 'muc-run',
}

export function RaceCharacter({
  character,
  className = 'h-20 w-auto',
  priority = false,
  sizes = '48px',
}: {
  character: Character
  className?: string
  priority?: boolean
  sizes?: string
}) {
  const asset = RUN_ASSET[character]
  if (resolveAsset(asset)) {
    return <CharacterImage name={asset} priority={priority} sizes={sizes} className={`object-contain ${className}`} />
  }
  if (character === 'muc') return <MucDoodle className={className} />
  return (
    <span
      aria-hidden="true"
      data-race-doodle={character}
      className={`inline-grid place-items-center rounded-full border-2 border-ink bg-sky font-display text-2xl text-ink shadow-sticker ${className}`}
    >
      {character === 'bin' ? 'B' : 'M'}
    </span>
  )
}
