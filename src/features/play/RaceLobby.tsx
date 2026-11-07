import { useState } from 'react'
import { useRepo } from '../../hooks/useRepo'
import { Button } from '../../components/Button'
import { HandNote } from '../../components/HandNote'
import { StickerCard } from '../../components/StickerCard'
import { RaceCharacter } from '../../components/RaceCharacter'
import { getNameError, normalizeName } from '../../domain/validation'
import { MSG } from '../../domain/messages'
import type { Character, Profile } from '../../domain/schemas'

const CHARACTERS: Array<{ id: Character; label: string }> = [
  { id: 'mi', label: 'Mi' },
  { id: 'bin', label: 'Bin' },
  { id: 'muc', label: 'Mực' },
]

export function RaceLobby({ onStart }: { onStart: (profile: Profile) => void }) {
  const repo = useRepo()
  const profileResult = repo.getProfile()
  const saved = profileResult.ok ? profileResult.data : null
  const [name, setName] = useState(saved?.name ?? '')
  const [character, setCharacter] = useState<Character | null>(saved?.character ?? null)
  const [nameError, setNameError] = useState<string | undefined>()
  const [characterError, setCharacterError] = useState<string | undefined>()

  const submit = () => {
    const nextNameError = getNameError(name)
    setNameError(nextNameError)
    setCharacterError(character ? undefined : 'Chọn nhân vật trước khi vào đua')
    if (nextNameError || !character) return
    const profile: Profile = { name: normalizeName(name), character }
    repo.saveProfile(profile)
    onStart(profile)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="text-center">
        <HandNote rotate="-3deg">{MSG.handGo}</HandNote>
        <h1 className="mt-3 font-display text-[clamp(2rem,8vw,3.4rem)] leading-none">
          <span className="display-tilt">{MSG.raceLobbyTitle}</span>
        </h1>
      </div>

      <StickerCard tone="paper" className="space-y-4">
        <div>
          <label htmlFor="race-name" className="block text-sm font-semibold">{MSG.raceName}</label>
          <input
            id="race-name"
            className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2 focus-visible:outline-4 focus-visible:outline-cobalt"
            value={name}
            onChange={(event) => {
              setName(event.target.value)
              if (nameError) setNameError(undefined)
            }}
            onBlur={() => setNameError(getNameError(name))}
            autoComplete="name"
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'race-name-error' : undefined}
          />
          {nameError ? <p id="race-name-error" className="mt-1 text-sm text-alert">{nameError}</p> : null}
        </div>

        <fieldset>
          <legend className="mb-2 block text-sm font-semibold">{MSG.raceCharacter}</legend>
          <div className="grid grid-cols-3 gap-2">
            {CHARACTERS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={character === item.id}
                onClick={() => {
                  setCharacter(item.id)
                  setCharacterError(undefined)
                }}
                className={`flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-[16px_20px_14px_22px] border-2 border-ink p-2 transition ${
                  character === item.id ? 'bg-sun shadow-sticker' : 'bg-white/80'
                }`}
              >
                <RaceCharacter character={item.id} className="h-20 w-20" />
                <span className="font-semibold">{item.label}</span>
              </button>
            ))}
          </div>
          {characterError ? <p className="mt-1 text-sm text-alert">{characterError}</p> : null}
        </fieldset>

        <Button className="min-h-[56px] w-full text-lg" onClick={submit}>
          {MSG.raceStart}
        </Button>
      </StickerCard>
    </div>
  )
}
