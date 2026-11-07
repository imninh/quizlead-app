import { expect, test, type Page } from '@playwright/test'
import { SEED_QUIZ } from '../../src/domain/seed'
import type { Attempt, Lead } from '../../src/domain/schemas'

test.use({ reducedMotion: 'no-preference' })

test.beforeEach(async ({ browser: _browser }, testInfo) => {
  test.skip(
    testInfo.project.name !== 'mobile-375' && testInfo.project.name !== 'desktop-1366',
    'Chạy E2E tính năng ở 375 và 1366',
  )
})

function aiQuestions() {
  return Array.from({ length: 5 }, (_, index) => ({
    id: `ai-e2e-${index}`,
    text: `Câu hỏi AI E2E ${index + 1}?`,
    options: ['Đáp án A', 'Đáp án B', 'Đáp án C', 'Đáp án D'],
    correctIndex: 0,
    explanation: 'Giải thích.',
  }))
}

async function gotoPage(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' })
}
async function startRace(page: Page, name = 'Người chơi') {
  await page.getByLabel('Tên của bạn').fill(name)
  await page.getByRole('button', { name: 'Mi' }).click()
  await page.getByRole('button', { name: 'Vào đua' }).click()
  await expect(page.getByText('Đối thủ của bạn')).toBeVisible()
  await expect(page.getByText(/Câu 1\/5/)).toBeVisible({ timeout: 6000 })
}

async function playFive(page: Page, waitMs = 800) {
  for (let index = 0; index < 5; index++) {
    await page.waitForTimeout(waitMs)
    await page.locator('button[data-color]').first().click()
    await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
  }
  await expect(page).toHaveURL(/\/result\//)
}

function cardFor(page: Page, title: string) {
  return page
    .getByText(title, { exact: true })
    .locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
}

async function seedAttempt(page: Page, options: { attempt?: Attempt; leads?: Lead[] } = {}) {
  const attempt: Attempt =
    options.attempt ?? {
      id: 'e2e-attempt',
      quizId: SEED_QUIZ.id,
      answers: SEED_QUIZ.questions.map((question, index) => ({
        questionId: question.id,
        selectedIndex: question.correctIndex,
        elapsedMs: 1000 + index * 100,
        isCorrect: true,
        points: 850,
      })),
      totalScore: 4250,
      correctCount: 5,
      totalTimeMs: 8000,
      finishedAt: 1,
    }
  await page.addInitScript(
    ({ quiz, attemptData, leads }) => {
      localStorage.setItem('quizlead:v1:seeded', 'true')
      localStorage.setItem('quizlead:v1:quizzes', JSON.stringify([quiz]))
      localStorage.setItem('quizlead:v1:activeQuizId', JSON.stringify(quiz.id))
      localStorage.setItem('quizlead:v1:attempts', JSON.stringify([attemptData]))
      localStorage.setItem('quizlead:v1:leads', JSON.stringify(leads))
      localStorage.setItem(
        'quizlead:v1:settings',
        JSON.stringify({ fanpageName: 'FPT Polytechnic', giftDescription: 'Voucher 50.000đ cho top 10', fanpageUrl: '' }),
      )
    },
    { quiz: SEED_QUIZ, attemptData: attempt, leads: options.leads ?? [] },
  )
}

test('F1 create quiz manually and with AI suggestion', async ({ page }) => {
  await page.route('**/api/generate-quiz', (route) =>
    route.fulfill({
      status: 200,
      json: { ok: true, questions: aiQuestions(), model: 'e2e/model', usage: { prompt_tokens: 1, completion_tokens: 1 } },
    }),
  )
  await page.route('**/api/ghost-run', (route) =>
    route.fulfill({
      status: 200,
      json: { ok: true, model: 'e2e/ghost', ranAt: 1, answers: Array.from({ length: 5 }, () => ({ selectedIndex: 0, elapsedMs: 2000, modelLatencyMs: 500, readingMs: 1500 })) },
    }),
  )

  await gotoPage(page, '/admin/quiz/new')
  await page.getByLabel('Tiêu đề').fill('Quiz E2E tay')
  for (let index = 0; index < 5; index++) {
    await page.getByLabel('Câu hỏi', { exact: true }).nth(index).fill(`Câu hỏi nhập tay số ${index + 1}?`)
    for (const letter of ['A', 'B', 'C', 'D']) {
      await page.getByPlaceholder(`Đáp án ${letter}`).nth(index).fill(`Đáp án ${letter} câu ${index + 1}`)
    }
  }
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByText('Quiz E2E tay', { exact: true })).toBeVisible()

  await gotoPage(page, '/admin/quiz/new')
  await page.getByLabel('Chủ đề', { exact: true }).fill('Ẩm thực Việt Nam')
  await page.getByRole('button', { name: 'Gợi ý AI' }).click()
  await expect(page.getByLabel('Câu hỏi', { exact: true }).first()).toHaveValue('Câu hỏi AI E2E 1?')
  await page.getByLabel('Tiêu đề').fill('Quiz AI E2E')
  await page.getByLabel('Câu hỏi', { exact: true }).first().fill('Câu hỏi AI đã sửa?')
  await page.getByRole('button', { name: 'Lưu' }).click()
  await expect(page.getByText('Quiz AI E2E', { exact: true })).toBeVisible()

  const card = cardFor(page, 'Quiz AI E2E')
  await card.getByRole('button', { name: 'Đặt làm đang chạy' }).click()
  await expect(card.getByText('Đang chạy')).toBeVisible()
})

test('F2 play with 30 second countdown, auto skip and speed scoring', async ({ page }) => {
  await page.clock.install()
  await gotoPage(page, `/play/${SEED_QUIZ.id}?opponent=rabbit`)
  await page.getByLabel('Tên của bạn').fill('Người chơi')
  await page.getByRole('button', { name: 'Mi' }).click()
  await page.getByRole('button', { name: 'Vào đua' }).click()
  await page.clock.fastForward(2100)
  await expect(page.getByText(/Câu 1\/5/)).toBeVisible()
  await page.clock.fastForward(800)
  await page.locator('button[data-color]').nth(SEED_QUIZ.questions[0]!.correctIndex).click()
  await expect(page.getByText('Chính xác!')).toBeVisible()
  const pointsText = await page.getByText(/^\+\d+$/).textContent()
  expect(Number.parseInt(pointsText!.slice(1), 10)).toBeGreaterThan(900)

  await page.clock.fastForward(4000)
  await expect(page.getByText(/Câu 2\/5/)).toBeVisible()
  await page.clock.fastForward(31000)
  await expect(page.getByText('Hết giờ!')).toBeVisible()
  await expect(page.getByText('+0')).toBeVisible()
  await page.clock.fastForward(4000)
  await expect(page.getByText(/Câu 3\/5/)).toBeVisible()
})

test('F3 result screen and lead form saved to localStorage', async ({ page }) => {
  await seedAttempt(page)
  await gotoPage(page, '/result/e2e-attempt')
  await expect(page.getByText('4.250', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Gửi thông tin' }).click()
  await expect(page.getByText('Tên phải từ 2 đến 50 ký tự')).toBeVisible()
  await expect(page.getByText(/Số điện thoại không hợp lệ/)).toBeVisible()
  await expect(page.getByText('Bạn cần đồng ý để nhận quà')).toBeVisible()

  await page.getByLabel(/Họ và tên/i).fill('Nguyễn Văn Test')
  await page.getByLabel(/Số điện thoại/i).fill('0912345678')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Gửi thông tin' }).click()
  await expect(page.getByText(/Bạn đã gửi thông tin nhận quà/)).toBeVisible()

  const leads = await page.evaluate(() => JSON.parse(localStorage.getItem('quizlead:v1:leads') ?? '[]') as Array<{ name: string; phone: string }>)
  expect(leads).toHaveLength(1)
  expect(leads[0]!.name).toBe('Nguyễn Văn Test')
  expect(leads[0]!.phone).toBe('0912345678')
})

test('F4 leaderboard top 10 sorted and masked', async ({ page }) => {
  const leads: Lead[] = Array.from({ length: 12 }, (_, index) => ({
    id: `lead-${index + 1}`,
    quizId: SEED_QUIZ.id,
    attemptId: `attempt-${index + 1}`,
    name: `Khách ${index + 1}`,
    phone: `09123456${String(index).padStart(2, '0')}`,
    consent: true,
    totalScore: 5000 - index * 100,
    correctCount: 5,
    totalTimeMs: 10000 + index * 1000,
    createdAt: 1 + index,
  }))
  await seedAttempt(page, { leads })
  await gotoPage(page, `/leaderboard/${SEED_QUIZ.id}?highlight=lead-3`)
  const localTab = page.getByRole('tab', { name: 'Trên máy này' })
  if (await localTab.isVisible()) await localTab.click()
  await expect(page.locator('tbody tr')).toHaveCount(10)
  await expect(page.locator('tbody tr').first()).toContainText('Khách 1')
  await expect(page.locator('tbody tr').last()).toContainText('Khách 10')
  await expect(page.getByText('Khách 11', { exact: true })).not.toBeVisible()
  await expect(page.getByText('09******00')).toBeVisible()
  const highlighted = page.getByText('Khách 3').locator('xpath=ancestor::tr')
  await expect(highlighted).toHaveClass(/bg-sun/)
})

test('F5 share copies the result text for Facebook', async ({ page }) => {
  const raceAttempt: Attempt = {
    id: 'e2e-attempt',
    quizId: SEED_QUIZ.id,
    answers: SEED_QUIZ.questions.map((question) => ({
      questionId: question.id,
      selectedIndex: question.correctIndex,
      elapsedMs: 1000,
      isCorrect: true,
      points: 850,
    })),
    totalScore: 4250,
    correctCount: 5,
    totalTimeMs: 48000,
    finishedAt: 1,
    opponent: { kind: 'rabbit', totalScore: 3900, totalTimeMs: 51000 },
    raceResult: 'win',
  }
  await seedAttempt(page, { attempt: raceAttempt })
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await gotoPage(page, '/result/e2e-attempt')
  await page.getByRole('button', { name: 'Copy kết quả để đăng Facebook' }).click()
  const text = await page.evaluate(() => navigator.clipboard.readText())
  expect(text).toContain('Mình vừa đạt 4.250 điểm (5/5 câu đúng)')
  expect(text).toContain('🏁 Mình đã thắng Thỏ trên đường đua!')

  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: () => Promise.reject(new Error('blocked')) },
      configurable: true,
    })
    document.execCommand = () => false
  })
  await page.getByRole('button', { name: 'Copy kết quả để đăng Facebook' }).click()
  const textarea = page.getByLabel('Nội dung cần copy')
  await expect(textarea).toBeVisible()
  await expect(textarea).toBeFocused()
  const selection = await textarea.evaluate((element) => {
    const area = element as HTMLTextAreaElement
    return { start: area.selectionStart, end: area.selectionEnd, length: area.value.length }
  })
  expect(selection.start).toBe(0)
  expect(selection.end).toBe(selection.length)
})

test('race against AI ghost and win or lose', async ({ page }) => {
  await gotoPage(page, `/play/${SEED_QUIZ.id}?opponent=ai`)
  await startRace(page)
  await expect(page.getByLabel('Đường đua')).toContainText('Trùm')
  await playFive(page)
  await expect(page.getByText(/Bạn (thắng|thua) rồi!|Hoà nhau!/)).toBeVisible()
  await expect(page.getByText(/Bạn (vượt|kém) Trùm|Bạn và Trùm/)).toBeVisible()
})

test('online publish, play by link and appear on shared leaderboard', async ({ page }) => {
  await gotoPage(page, '/admin')
  await page.evaluate(() => localStorage.setItem('quizlead:v1:adminPasscode', 'test-pass-123'))
  const publishButton = page.getByRole('button', { name: /^Xuất bản/ }).first()
  await expect(publishButton).toBeVisible({ timeout: 8000 })
  await publishButton.click()
  await expect(page.getByText(/Đã xuất bản · v\d+/).first()).toBeVisible({ timeout: 8000 })

  await gotoPage(page, `/q/${SEED_QUIZ.id}`)
  await startRace(page, 'Nguyễn Văn Online')
  for (let index = 0; index < 5; index++) {
    await page.waitForTimeout(1400)
    await page.locator('button[data-color]').first().click()
    await page.getByRole('button', { name: 'Câu tiếp theo' }).click()
  }
  await expect(page).toHaveURL(/\/result\//)
  await page.getByLabel(/Số điện thoại/i).fill('0912345678')
  await page.getByRole('checkbox').check()
  const scoreResponse = page.waitForResponse(
    (response) => response.url().includes('/api/scores') && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: 'Gửi thông tin' }).click()
  const response = await scoreResponse
  const body = await response.json()
  expect(JSON.stringify(body)).not.toContain('0912345678')
  expect(body.entry.phoneMasked).toBe('09******78')
  await expect(page.getByText('Đã gửi lên bảng xếp hạng chung.')).toBeVisible()

  await gotoPage(page, `/leaderboard/${SEED_QUIZ.id}`)
  await expect(page.getByRole('tab', { name: 'Toàn bộ người chơi (online)' })).toBeVisible()
  await expect(page.getByText('Nguyễn Văn Online')).toBeVisible()
  await expect(page.getByText('09******78')).toBeVisible()
})
