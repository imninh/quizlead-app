import { AVAILABLE_ASSETS } from '../assets/manifest.generated'

const AVAILABLE = new Set<string>(AVAILABLE_ASSETS)

const FALLBACKS: Record<string, string> = {
  'mi-skate-wave': 'mi-phone-cool',
  'muc-tangled': 'mi-oops',
  'muc-peek': 'mi-oops',
  'mi-run': 'mi-hero-jump',
}

export function resolveAsset(name: string): string | null {
  if (AVAILABLE.has(name)) return name
  const fallback = FALLBACKS[name]
  if (fallback && AVAILABLE.has(fallback)) return fallback
  return null
}
