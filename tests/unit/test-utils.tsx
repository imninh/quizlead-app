import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom'
import { RepoProvider } from '../../src/hooks/useRepo'
import { ToastProvider } from '../../src/components/Toast'
import { routes } from '../../src/router'
import { createStorageRepo } from '../../src/services/storage'
import { createInitialState } from '../../src/domain/game'
import type { Quiz } from '../../src/domain/schemas'
import type { RaceOpponent } from '../../src/domain/race'

export function resetStorage() {
  localStorage.clear()
  sessionStorage.clear()
}

export function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return {
    router,
    ...render(
      <RepoProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </RepoProvider>,
    ),
  }
}

export function renderCustomRouter(routeObjects: RouteObject[], initialPath: string, element?: ReactElement) {
  const router = createMemoryRouter(routeObjects, { initialEntries: [initialPath] })
  return {
    router,
    ...render(
      <>
        {element}
        <RouterProvider router={router} />
      </>,
    ),
  }
}

/** Nạp trước các chunk admin (React.lazy) để test không thấy màn "Đang tải…". */
export async function preloadAdminRoutes(): Promise<void> {
  const pages: Array<[string, string]> = [
    ['/admin', 'Quiz'],
    ['/admin/quiz/new', 'Tạo quiz'],
    ['/admin/leads', 'Khách hàng'],
    ['/admin/settings', 'Cài đặt'],
  ]
  for (const [path, heading] of pages) {
    const view = renderApp(path)
    await screen.findByRole('heading', { name: heading })
    view.unmount()
  }
}

/** Vào thẳng màn câu hỏi (bỏ qua lobby) cho test cơ chế chơi. */
export function seedPlaySession(
  quiz: Quiz,
  opponent: RaceOpponent | null = null,
  attemptId = 'test-attempt',
): void {
  const repo = createStorageRepo()
  repo.saveQuiz(quiz)
  repo.setActiveQuizId(quiz.id)
  repo.saveProfile({ name: 'Người chơi', character: 'mi' })
  const now = Date.now()
  const state = {
    ...createInitialState(),
    status: 'question' as const,
    quiz,
    deadline: now + 700 + 30000,
    revealUntil: now + 700,
    opponent,
    attemptId,
  }
  sessionStorage.setItem('quizlead:v1:session', JSON.stringify({ quizId: quiz.id, state }))
}
