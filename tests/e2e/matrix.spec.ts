import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { SEED_QUIZ } from '../../src/domain/seed'
import type { Attempt, Lead, Quiz } from '../../src/domain/schemas'

const BASE = 'http://127.0.0.1:4173'
const OUT_DIR = resolve(process.cwd(), 'test-results', 'matrix')
const REPORT_DIR = resolve(process.cwd(), 'test-results', 'matrix')

const VIEWPORTS = [
  { width: 320, height: 568 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1366, height: 768 },
  { width: 1920, height: 1080 },
  { width: 2560, height: 1440 },
]

const SCREENS = [
  'trang-dau',
  'vao-dua',
  'cau-hoi',
  'chinh-xac',
  'ket-qua',
  'bang-xep-hang',
  'admin-tao-quiz',
  'admin-khach-hang',
] as const

type ScreenName = (typeof SCREENS)[number]
type CellResult = { screen: ScreenName; ok: boolean; failures: string[]; axeSerious: number }

const longQuiz: Quiz = {
  ...SEED_QUIZ,
  id: 'matrix-long-quiz',
  title: 'Quiz câu hỏi dài nhất',
  questions: SEED_QUIZ.questions.map((question, index) =>
    index === 0
      ? {
          ...question,
          text: 'Câu hỏi rất dài để kiểm tra xuống dòng trên màn hình nhỏ: '.padEnd(300, 'nội dung kiểm thử '),
          options: [
            'Đáp án rất dài cần hiển thị trọn vẹn: '.padEnd(150, 'chữ '),
            'Đáp án rất dài cần hiển thị trọn vẹn: '.padEnd(150, 'mực '),
            'Đáp án rất dài cần hiển thị trọn vẹn: '.padEnd(150, 'bút '),
            'Đáp án rất dài cần hiển thị trọn vẹn: '.padEnd(150, 'giấy '),
          ] as [string, string, string, string],
        }
      : question,
  ),
  createdAt: 1,
  updatedAt: 1,
}

function leads(): Lead[] {
  return Array.from({ length: 12 }, (_, index) => ({
    id: `matrix-lead-${index + 1}`,
    quizId: SEED_QUIZ.id,
    attemptId: `matrix-attempt-${index + 1}`,
    name: `Khách ${index + 1}`,
    phone: `09123456${String(index).padStart(2, '0')}`,
    consent: true,
    totalScore: 5000 - index * 100,
    correctCount: 5,
    totalTimeMs: 10000 + index * 1000,
    createdAt: 1 + index,
    character: index % 3 === 0 ? 'mi' : index % 3 === 1 ? 'bin' : 'muc',
    raceResult: index === 0 ? 'win' : 'lose',
    opponentKind: index === 0 ? 'ai' : 'rabbit',
  }))
}

const attempt: Attempt = {
  id: 'matrix-result',
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
  totalTimeMs: 48000,
  finishedAt: 1,
  opponent: { kind: 'rabbit', totalScore: 3900, totalTimeMs: 51000 },
  raceResult: 'win',
}

async function seedStorage(context: BrowserContext, options: { quiz?: Quiz; leads?: Lead[]; attempts?: Attempt[]; activeId?: string | null }) {
  await context.addInitScript(
    ({ quiz, leadData, attemptData, activeId }) => {
      localStorage.setItem('quizlead:v1:seeded', 'true')
      localStorage.setItem('quizlead:v1:quizzes', JSON.stringify(quiz ? [quiz] : []))
      localStorage.setItem('quizlead:v1:activeQuizId', JSON.stringify(activeId))
      localStorage.setItem('quizlead:v1:leads', JSON.stringify(leadData))
      localStorage.setItem('quizlead:v1:attempts', JSON.stringify(attemptData))
      localStorage.setItem('quizlead:v1:profile', JSON.stringify({ name: 'Người chơi', character: 'mi' }))
      localStorage.setItem(
        'quizlead:v1:settings',
        JSON.stringify({ fanpageName: 'FPT Polytechnic', giftDescription: 'Voucher 50.000đ cho top 10', fanpageUrl: 'https://facebook.com/fptpoly' }),
      )
    },
    {
      quiz: options.quiz ?? SEED_QUIZ,
      leadData: options.leads ?? [],
      attemptData: options.attempts ?? [],
      activeId: options.activeId === undefined ? (options.quiz ?? SEED_QUIZ).id : options.activeId,
    },
  )
}

async function seedQuestion(context: BrowserContext, quiz: Quiz = longQuiz) {
  await seedStorage(context, { quiz })
  await context.addInitScript((quizData) => {
    const now = Date.now()
    const opponent = {
      kind: 'rabbit',
      answers: quizData.questions.map((question: { id: string }) => ({
        questionId: question.id,
        selectedIndex: 0,
        elapsedMs: 5000,
        isCorrect: false,
        points: 0,
      })),
    }
    sessionStorage.setItem(
      'quizlead:v1:session',
      JSON.stringify({
        quizId: quizData.id,
        state: {
          status: 'question',
          quiz: quizData,
          questionIndex: 0,
          deadline: now + 60000,
          revealUntil: now - 1000,
          feedbackUntil: null,
          answers: [],
          attemptId: 'matrix-attempt',
          opponent,
        },
      }),
    )
  }, quiz)
}

async function openScreen(browser: Browser, width: number, height: number, screen: ScreenName): Promise<Page> {
  const context = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  const quiz = screen === 'cau-hoi' || screen === 'chinh-xac' ? longQuiz : SEED_QUIZ

  if (screen === 'cau-hoi' || screen === 'chinh-xac') {
    await seedQuestion(context, quiz)
  } else if (screen === 'ket-qua') {
    await seedStorage(context, { quiz: SEED_QUIZ, attempts: [attempt] })
  } else if (screen === 'bang-xep-hang') {
    await seedStorage(context, { quiz: SEED_QUIZ, leads: leads(), attempts: [attempt] })
    await page.route('**/api/health', (route) => route.fulfill({ status: 200, json: { online: true } }))
    await page.route('**/api/leaderboard/**', (route) =>
      route.fulfill({
        status: 200,
        json: {
          ok: true,
          version: 1,
          entries: leads().slice(0, 3).map((lead) => ({
            entryId: lead.id,
            quizId: SEED_QUIZ.id,
            version: 1,
            name: lead.name,
            character: lead.character,
            phoneMasked: '09******78',
            totalScore: lead.totalScore,
            totalTimeMs: lead.totalTimeMs,
            correctCount: lead.correctCount,
            createdAt: lead.createdAt,
          })),
        },
      }),
    )
  } else if (screen === 'admin-khach-hang') {
    await seedStorage(context, { quiz: SEED_QUIZ, leads: leads(), attempts: [attempt] })
  } else if (screen === 'admin-tao-quiz') {
    await seedStorage(context, { quiz: SEED_QUIZ })
  } else {
    await seedStorage(context, { quiz: SEED_QUIZ })
  }

  const path =
    screen === 'trang-dau'
      ? '/'
      : screen === 'vao-dua'
        ? `/play/${SEED_QUIZ.id}`
        : screen === 'cau-hoi' || screen === 'chinh-xac'
          ? `/play/${longQuiz.id}`
          : screen === 'ket-qua'
            ? '/result/matrix-result'
            : screen === 'bang-xep-hang'
              ? `/leaderboard/${SEED_QUIZ.id}`
              : screen === 'admin-tao-quiz'
                ? '/admin/quiz/new'
                : '/admin/leads'

  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(350)

  if (screen === 'chinh-xac') {
    await page.locator('button[data-color]').nth(longQuiz.questions[0]!.correctIndex).click()
    await expect(page.getByText('Chính xác!')).toBeVisible()
  }
  if (screen === 'admin-tao-quiz') {
    await page.getByRole('button', { name: 'Điền mẫu' }).click()
    await page.waitForTimeout(200)
  }
  return page
}

async function inspectScreen(page: Page, screen: ScreenName, width: number, height: number): Promise<string[]> {
  const failures: string[] = []
  const metrics = await page.evaluate((screenName) => {
    const doc = document.documentElement
    const horizontal = doc.scrollWidth > doc.clientWidth
    const clickableTooSmall: string[] = []
    const textTooSmall: string[] = []
    const playerScreen = !screenName.startsWith('admin-')
    if (playerScreen) {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('button, a[href]'))) {
        const rect = element.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (rect.width < 43.5 || rect.height < 43.5) {
          clickableTooSmall.push(`${element.tagName}:${(element.textContent ?? '').trim().slice(0, 24)} ${Math.round(rect.width)}x${Math.round(rect.height)}`)
        }
      }
    }
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      const rect = element.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) continue
      if (element.closest('[aria-hidden="true"]') || element.closest('.sr-only')) continue
      const ownText = Array.from(element.childNodes).some((node) => node.nodeType === 3 && (node.textContent ?? '').trim().length > 0)
      if (!ownText) continue
      const size = Number.parseFloat(getComputedStyle(element).fontSize)
      if (Number.isFinite(size) && size < 11) {
        textTooSmall.push(`${element.tagName}:${(element.textContent ?? '').trim().slice(0, 24)} ${size}px`)
      }
    }
    const clipped: string[] = []
    if (screenName === 'cau-hoi') {
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('.answer-text, button[data-color]'))) {
        if (element.scrollWidth > element.clientWidth + 1) clipped.push(`ngang:${(element.textContent ?? '').slice(0, 16)}`)
        if (element.scrollHeight > element.clientHeight + 1) clipped.push(`dọc:${(element.textContent ?? '').slice(0, 16)}`)
      }
    }
    return { horizontal, clickableTooSmall, textTooSmall, clipped }
  }, screen)

  if (metrics.horizontal) failures.push('cuộn ngang')
  if (metrics.clickableTooSmall.length) failures.push(`nút nhỏ: ${metrics.clickableTooSmall.slice(0, 3).join(' | ')}`)
  if (metrics.textTooSmall.length) failures.push(`chữ <11px: ${metrics.textTooSmall.slice(0, 3).join(' | ')}`)
  if (metrics.clipped.length) failures.push(`cắt chữ: ${metrics.clipped.slice(0, 3).join(' | ')}`)
  await page.screenshot({ path: resolve(OUT_DIR, `${screen}-${width}x${height}.png`), fullPage: true })
  return failures
}

for (const viewport of VIEWPORTS) {
  test(`${viewport.width}x${viewport.height} matrix`, async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1366', 'Matrix tự đổi viewport')
    test.setTimeout(240000)
    const cells: CellResult[] = []
    for (const screen of SCREENS) {
      const page = await openScreen(browser, viewport.width, viewport.height, screen)
      const failures = await inspectScreen(page, screen, viewport.width, viewport.height)
      let axeSerious = 0
      if ((viewport.width === 375 || viewport.width === 1366) && screen !== 'chinh-xac') {
        const axe = await new AxeBuilder({ page }).analyze()
        const serious = axe.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')
        axeSerious = serious.length
        if (serious.length) {
          failures.push(`axe: ${serious.map((violation) => `${violation.id}(${violation.impact})`).join(', ')}`)
        }
      }
      cells.push({ screen, ok: failures.length === 0, failures, axeSerious })
      await page.context().close()
    }
    writeFileSync(
      resolve(REPORT_DIR, `matrix-${viewport.width}x${viewport.height}.json`),
      JSON.stringify(cells, null, 2),
      'utf8',
    )
    const failed = cells.filter((cell) => !cell.ok)
    expect(failed, failed.map((cell) => `${cell.screen}: ${cell.failures.join('; ')}`).join('\n')).toEqual([])
  })
}
