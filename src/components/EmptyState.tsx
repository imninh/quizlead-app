import { Button } from './Button'
import { CharacterImage } from './CharacterImage'
import { HandNote } from './HandNote'

export function EmptyState({
  title,
  actionLabel,
  onAction,
  character = 'muc-sleeping-box',
  note,
}: {
  title: string
  actionLabel?: string
  onAction?: () => void
  character?: string
  note?: string
}) {
  return (
    <div className="mx-auto max-w-xl py-8 text-center">
      <div className="mx-auto mb-3 flex max-h-48 justify-center">
        <CharacterImage name={character} className="h-40 w-auto object-contain" width={240} height={240} sizes="160px" />
      </div>
      {note ? <div className="mb-3"><HandNote rotate="2deg">{note}</HandNote></div> : null}
      <p className="text-lg font-semibold">{title}</p>
      {actionLabel && onAction ? (
        <div className="mt-4">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      ) : null}
    </div>
  )
}
