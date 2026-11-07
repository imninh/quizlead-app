import { describe, expect, it } from 'vitest'
import { applyAbsoluteOg } from '../../server/ogUrl'

const HTML = `<!doctype html>
<html><head>
<meta property="og:image" content="/og-image.jpg" />
<meta name="twitter:image" content="/og-image.jpg" />
</head><body></body></html>`

describe('index html', () => {
  it('og image becomes absolute when VITE_APP_URL is set', () => {
    const result = applyAbsoluteOg(HTML, 'https://quizlead.example/')
    expect(result).toContain('<meta property="og:image" content="https://quizlead.example/og-image.jpg" />')
    expect(result).toContain('<meta name="twitter:image" content="https://quizlead.example/og-image.jpg" />')
    expect(result).toContain('<meta property="og:url" content="https://quizlead.example/" />')
    expect(result).not.toContain('%VITE_APP_URL%')
  })

  it('og image stays relative without VITE_APP_URL', () => {
    expect(applyAbsoluteOg(HTML, undefined)).toBe(HTML)
    expect(applyAbsoluteOg(HTML, '   ')).toBe(HTML)
  })
})
