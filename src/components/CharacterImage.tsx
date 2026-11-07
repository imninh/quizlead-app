import { Doodle } from './Doodle'
import { resolveAsset } from './assetResolver'
import { ASSETS_WITH_3X, ASSET_WIDTHS } from '../assets/manifest.generated'

const PORTRAIT = new Set(['mi-hero-jump', 'mi-point-up', 'mi-phone-cool'])
const HAS_3X = new Set<string>(ASSETS_WITH_3X)

type WidthInfo = { x1: number; x2?: number; x3?: number }

function widthInfoFor(name: string): WidthInfo | null {
  return name in ASSET_WIDTHS ? ASSET_WIDTHS[name as keyof typeof ASSET_WIDTHS] : null
}

type CharacterImageProps = {
  name: string
  alt?: string
  priority?: boolean
  className?: string
  width?: number
  height?: number
  /** Kích thước hiển thị thật, dùng cho srcSet theo `w` (bắt buộc). */
  sizes: string
}

export function CharacterImage({
  name,
  alt = '',
  priority = false,
  className = 'h-auto w-full max-w-full object-contain',
  width,
  height,
  sizes,
}: CharacterImageProps) {
  const resolved = resolveAsset(name)
  if (!resolved) {
    return <Doodle kind="smiley" size={160} color="var(--color-cobalt)" className={className} />
  }

  const ratio = PORTRAIT.has(resolved) ? { width: 600, height: 900 } : { width: 720, height: 720 }
  const finalWidth = width ?? ratio.width
  const finalHeight = height ?? ratio.height
  const decorative = alt.length === 0
  const info = widthInfoFor(resolved)
  const useWidths = HAS_3X.has(resolved) && info?.x2 !== undefined && info.x3 !== undefined
  const srcSet = useWidths
    ? `/assets/${resolved}@1x.webp ${info.x1}w, /assets/${resolved}@2x.webp ${info.x2}w, /assets/${resolved}@3x.webp ${info.x3}w`
    : `/assets/${resolved}@1x.webp 1x, /assets/${resolved}@2x.webp 2x`

  return (
    <img
      src={`/assets/${resolved}@1x.webp`}
      srcSet={srcSet}
      sizes={useWidths ? sizes : undefined}
      width={finalWidth}
      height={finalHeight}
      alt={alt}
      aria-hidden={decorative ? true : undefined}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
      data-asset={resolved}
    />
  )
}
