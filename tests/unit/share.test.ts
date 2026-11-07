import { describe, it, expect } from 'vitest'
import { buildShareText } from '../../src/domain/share'

describe('share', () => {
  it('contains score, correct, title, url, hashtag', () => {
    const text = buildShareText({
      score: 4250,
      correctCount: 4,
      totalTimeMs: 12345,
      quizTitle: 'Marketing',
      fanpageName: 'FPT Polytechnic',
      appUrl: 'https://example.com',
    })
    expect(text).toContain('4.250')
    expect(text).toContain('4/5')
    expect(text).toContain('Marketing')
    expect(text).toContain('https://example.com')
    expect(text).toContain('#minigame')
    expect(text).toContain('#fptpolytechnic')
  })
})
