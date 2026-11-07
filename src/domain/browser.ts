const IN_APP_TOKENS = ['fban', 'fbav', 'fb_iab', 'messenger', 'instagram', 'zalo'] as const

/**
 * Nhận diện trình duyệt trong app Facebook / Messenger / Instagram / Zalo.
 * Hàm thuần để dùng chung client và test.
 */
export function isInAppBrowser(userAgent: string): boolean {
  const ua = userAgent.toLowerCase()
  return IN_APP_TOKENS.some((token) => ua.includes(token))
}
