import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { AdminChunkBoundary } from './components/AdminChunkBoundary'
import { PageLoader } from './components/PageLoader'
import HomePage from './features/home/HomePage'
import PlayPage from './features/play/PlayPage'
import OnlineQuizPage from './features/play/OnlineQuizPage'
import ResultPage from './features/result/ResultPage'
import LeaderboardPage from './features/leaderboard/LeaderboardPage'
import NotFound from './features/shared/NotFound'

// oxlint-disable-next-line react/only-export-components
const AdminLayout = lazy(() => import('./features/admin/AdminLayout'))
// oxlint-disable-next-line react/only-export-components
const AdminQuizListPage = lazy(() => import('./features/admin/AdminQuizListPage'))
// oxlint-disable-next-line react/only-export-components
const AdminQuizEditPage = lazy(() => import('./features/admin/AdminQuizEditPage'))
// oxlint-disable-next-line react/only-export-components
const AdminLeadsPage = lazy(() => import('./features/admin/AdminLeadsPage'))
// oxlint-disable-next-line react/only-export-components
const AdminSettingsPage = lazy(() => import('./features/admin/AdminSettingsPage'))

function adminPage(node: ReactNode): ReactNode {
  return (
    <AdminChunkBoundary>
      <Suspense fallback={<PageLoader />}>{node}</Suspense>
    </AdminChunkBoundary>
  )
}

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'play/:quizId', element: <PlayPage /> },
      { path: 'q/:quizId', element: <OnlineQuizPage /> },
      { path: 'result/:attemptId', element: <ResultPage /> },
      { path: 'leaderboard/:quizId', element: <LeaderboardPage /> },
      {
        path: 'admin',
        element: adminPage(<AdminLayout />),
        children: [
          { index: true, element: adminPage(<AdminQuizListPage />) },
          { path: 'quiz/new', element: adminPage(<AdminQuizEditPage />) },
          { path: 'quiz/:id/edit', element: adminPage(<AdminQuizEditPage />) },
          { path: 'leads', element: adminPage(<AdminLeadsPage />) },
          { path: 'settings', element: adminPage(<AdminSettingsPage />) },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]
