import { expect, test, type Page } from '@playwright/test'

const routes = [
  '/',
  '/play/seed-digital-marketing',
  '/leaderboard/seed-digital-marketing',
  '/admin',
  '/admin/quiz/new',
  '/admin/leads',
  '/admin/settings',
  '/khong-ton-tai',
]

async function collectPageErrors(page: Page): Promise<string[]> {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  return errors
}

async function assertPageHealthy(page: Page, errors: string[]) {
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(300)
  const text = await page.locator('body').innerText()
  expect(text.trim().length).toBeGreaterThan(0)
  const hasHorizontalScroll = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(hasHorizontalScroll).toBe(false)
  expect(errors).toEqual([])
}

async function startRace(page: Page) {
  await page.getByLabel('Tên của bạn').fill('Người chơi')
  await page.getByRole('button', { name: 'Mi' }).click()
  await page.getByRole('button', { name: 'Vào đua' }).click()
  await expect(page.getByText('Đối thủ của bạn')).toBeVisible()
  await expect(page.getByText(/Câu 1\/5/)).toBeVisible({ timeout: 6000 })
}

function ghostFixture() {
  return {
    ok: true,
    model: 'smoke/ghost',
    ranAt: 1,
    answers: Array.from({ length: 5 }, () => ({ selectedIndex: 0, elapsedMs: 3000 })),
  }
}

for (const route of routes) {
  test(`${route} renders without crash`, async ({ page }) => {
    const errors = await collectPageErrors(page)
    await page.goto(route)
    await assertPageHealthy(page, errors)
  })
}

test('create quiz, set active and play it', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.route('**/api/ghost-run', (route) => route.fulfill({ status: 200, json: ghostFixture() }))
  await page.goto('/admin/quiz/new')
  await page.getByRole('button', { name: 'Điền mẫu' }).click()
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  const newCard = page
    .getByText('Quiz mẫu', { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
  await expect(newCard).toBeVisible()
  await newCard.getByRole('button', { name: 'Đặt làm đang chạy' }).click()
  await expect(newCard.getByText('Đang chạy')).toBeVisible()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Quiz mẫu' })).toBeVisible()
  await assertPageHealthy(page, errors)
})

function realQuestions() {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `smoke-${i}`,
    text: `Câu hỏi AI thật ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    correctIndex: 0,
    explanation: 'Giải thích.',
  }))
}

test('AI real success shows model badge', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.route('**/api/generate-quiz', (route) =>
    route.fulfill({
      status: 200,
      json: {
        ok: true,
        questions: realQuestions(),
        model: 'smoke/model',
        usage: { prompt_tokens: 100, completion_tokens: 200 },
      },
    }),
  )
  await page.goto('/admin/quiz/new')
  await page.getByLabel('Chủ đề', { exact: true }).fill('ẩm thực')
  await page.getByRole('button', { name: 'Gợi ý AI' }).click()
  await expect(page.getByText('Tạo bởi AI · smoke/model')).toBeVisible()
  await expect(page.getByText('AI gợi ý, hãy kiểm tra lại')).toHaveCount(5)
  await assertPageHealthy(page, errors)
})

test('AI real failure offers mock fallback without auto switch', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.route('**/api/generate-quiz', (route) =>
    route.fulfill({ status: 500, json: { ok: false, code: 'UPSTREAM' } }),
  )
  await page.goto('/admin/quiz/new')
  await page.getByLabel('Chủ đề', { exact: true }).fill('ẩm thực')
  await page.getByRole('button', { name: 'Gợi ý AI' }).click()
  await expect(page.getByText('AI đang bận. Thử lại sau.')).toBeVisible()
  await expect(page.getByLabel('Câu hỏi', { exact: true }).first()).toHaveValue('')
  await page.getByRole('button', { name: 'Dùng bộ câu hỏi mẫu (Mock)' }).click()
  await expect(page.getByLabel('Câu hỏi', { exact: true }).first()).toHaveValue(
    'Phở là món ăn truyền thống của nước nào?',
    { timeout: 5000 },
  )
  await expect(page.getByText('AI gợi ý, hãy kiểm tra lại')).toHaveCount(5)
  await expect(page.getByText('Bản demo vòng loại - Dữ liệu mô phỏng AI').first()).toBeVisible()
  // Lỗi 500 do chính test giả lập: trình duyệt luôn log dòng này, không phải lỗi của app.
  const unexpected = errors.filter((e) => !e.includes('status of 500'))
  await assertPageHealthy(page, unexpected)
})

test('corrupt localStorage shows recovery banner and app still works', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.addInitScript(() => {
    localStorage.setItem('quizlead:v1:leads', 'abc')
  })
  await page.goto('/')
  await expect(page.getByText(/Danh sách khách hàng bị hỏng, đã tạo bản sao lưu/)).toBeVisible()

  await page.goto('/admin/leads')
  await expect(page.getByRole('heading', { name: 'Khách hàng' })).toBeVisible()
  await assertPageHealthy(page, errors)
})

test('quota exceeded on lead submit shows error and keeps form', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'quizlead:v1:leads') throw new DOMException('quota', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })

  await page.goto('/play/seed-digital-marketing')
  await startRace(page)
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(750)
    await page.keyboard.press('1')
    await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
  }
  await expect(page).toHaveURL(/\/result\//)

  await page.getByRole('checkbox').check()
  await page.getByLabel('Họ và tên').fill('Nguyen Van A')
  await page.getByLabel('Số điện thoại').fill('0912345678')
  const sendButton = page.getByRole('button', { name: 'Gửi thông tin' })
  await sendButton.scrollIntoViewIfNeeded()
  await sendButton.click()

  await expect(page.getByText(/Bộ nhớ trình duyệt đã đầy/)).toBeVisible()
  await expect(page.getByLabel('Họ và tên')).toHaveValue('Nguyen Van A')
  await expect(page.getByLabel('Số điện thoại')).toHaveValue('0912345678')
  await assertPageHealthy(page, errors)
})

test('offline disables AI suggestion', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.goto('/admin/quiz/new')
  await expect(page.getByRole('button', { name: 'Gợi ý AI' })).toBeVisible()
  await page.context().setOffline(true)
  try {
    await expect(page.getByRole('button', { name: 'Gợi ý AI' })).toBeDisabled()
    await expect(page.getByText(/Bạn đang offline/)).toBeVisible()

    await page.getByLabel('Chủ đề', { exact: true }).fill('ẩm thực')
    await page.getByRole('button', { name: 'Dùng bộ câu hỏi mẫu (Mock)' }).click()
    await expect(page.getByLabel('Câu hỏi', { exact: true }).first()).toHaveValue(
      'Phở là món ăn truyền thống của nước nào?',
      { timeout: 5000 },
    )
    await expect(page.getByText('AI gợi ý, hãy kiểm tra lại')).toHaveCount(5)
  } finally {
    await page.context().setOffline(false)
  }
  // Mất mạng do chính test giả lập: trình duyệt log ERR_INTERNET_DISCONNECTED, không phải lỗi app.
  const unexpected = errors.filter((e) => !e.includes('ERR_INTERNET_DISCONNECTED'))
  await assertPageHealthy(page, unexpected)
})

test.describe('motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' })

  test('full playthrough with motion reaches result without console errors', async ({ page }) => {
    const errors = await collectPageErrors(page)
    await page.goto('/play/seed-digital-marketing')
    await startRace(page)
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(750)
      await page.locator('button[data-color]').first().click()
      await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
    }
    await expect(page).toHaveURL(/\/result\//)
    await assertPageHealthy(page, errors)
  })
})

test('AI ghost opponent shows race result', async ({ page }) => {
  const errors = await collectPageErrors(page)
  await page.goto('/play/seed-digital-marketing?opponent=ai')
  await startRace(page)
  await expect(page.getByLabel('Đường đua')).toContainText('Trùm')
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(750)
    await page.locator('button[data-color]').first().click()
    await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
  }
  await expect(page).toHaveURL(/\/result\//)
  await expect(page.getByText(/Bạn (thắng|thua) rồi!|Hoà nhau!/)).toBeVisible()
  await assertPageHealthy(page, errors)
})

test('publish quiz and see player on online leaderboard', async ({ page }) => {
  test.setTimeout(90_000)
  const errors = await collectPageErrors(page)
  await page.goto('/admin')
  await page.evaluate(() => localStorage.setItem('quizlead:v1:adminPasscode', 'test-pass-123'))
  const publishButton = page.getByRole('button', { name: /^Xuất bản/ }).first()
  await expect(publishButton).toBeVisible({ timeout: 8000 })
  await publishButton.click()
  await expect(page.getByText(/Đã xuất bản · v\d+/).first()).toBeVisible({ timeout: 8000 })

  await page.goto('/q/seed-digital-marketing')
  await startRace(page)
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1400)
    await page.locator('button[data-color]').first().click()
    await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
  }
  await expect(page).toHaveURL(/\/result\//)
  await page.getByLabel(/Số điện thoại/i).fill('0912345678')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Gửi thông tin' }).click()
  await expect(page.getByText('Đã gửi lên bảng xếp hạng chung.')).toBeVisible({ timeout: 8000 })

  await page.goto('/leaderboard/seed-digital-marketing')
  await expect(page.getByRole('tab', { name: 'Toàn bộ người chơi (online)' })).toBeVisible()
  await expect(page.getByText('Người chơi').first()).toBeVisible()
  await assertPageHealthy(page, errors)
})

test('online disabled keeps the local leaderboard flow', async ({ page }) => {
  await page.route('**/api/health', (route) => route.fulfill({ status: 200, json: { online: false } }))
  await page.route('**/api/leaderboard/**', (route) =>
    route.fulfill({ status: 503, json: { ok: false, code: 'OFFLINE_MODE' } }),
  )
  await page.goto('/leaderboard/seed-digital-marketing')
  await expect(page.getByText('Chưa có ai trên bảng, bạn sẽ là người đầu tiên!')).toBeVisible()
  await expect(page.getByRole('tab', { name: 'Toàn bộ người chơi (online)' })).not.toBeVisible()
})
