export type CopyResult = { ok: true; method: 'clipboard' | 'execCommand' } | { ok: false }

export async function copyText(text: string): Promise<CopyResult> {
  if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text)
      return { ok: true, method: 'clipboard' }
    } catch {
      // fall through
    }
  }
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (success) return { ok: true, method: 'execCommand' }
    } catch {
      // fall through
    }
  }
  return { ok: false }
}
