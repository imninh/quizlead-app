import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from '../../src/domain/browser'

describe('isInAppBrowser', () => {
  it('detects Facebook and Messenger in-app user agents', () => {
    const facebook =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/400.0.0.1.100;FBBV/123456;FB_IAB/FB4A;FBDV/iPhone14,2]'
    const messenger =
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Messenger/400.0.0.1'
    const instagram =
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0'
    const zalo =
      'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36 Zalo/23.0'

    expect(isInAppBrowser(facebook)).toBe(true)
    expect(isInAppBrowser(messenger)).toBe(true)
    expect(isInAppBrowser(instagram)).toBe(true)
    expect(isInAppBrowser(zalo)).toBe(true)
  })

  it('returns false for normal Chrome and Safari', () => {
    const chrome =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    const safari =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'

    expect(isInAppBrowser(chrome)).toBe(false)
    expect(isInAppBrowser(safari)).toBe(false)
    expect(isInAppBrowser('')).toBe(false)
  })
})
