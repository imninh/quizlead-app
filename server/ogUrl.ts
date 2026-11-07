/** Thay og:image/twitter:image/og:url thành URL tuyệt đối khi build có VITE_APP_URL. */
export function applyAbsoluteOg(html: string, appUrl: string | undefined): string {
  const raw = appUrl?.trim()
  if (!raw) return html
  const base = raw.replace(/\/+$/, '')
  if (!base) return html
  const image = `${base}/og-image.jpg`
  return html
    .replace(/<meta property="og:image" content="[^"]*"\s*\/?>/, `<meta property="og:image" content="${image}" />`)
    .replace(/<meta name="twitter:image" content="[^"]*"\s*\/?>/, `<meta name="twitter:image" content="${image}" />`)
    .replace('</head>', `    <meta property="og:url" content="${base}/" />\n  </head>`)
}
