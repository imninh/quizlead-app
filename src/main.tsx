import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import './index.css'
import { routes } from './router'
import { RepoProvider } from './hooks/useRepo'
import { ToastProvider } from './components/Toast'
import { RootErrorBoundary } from './components/RootErrorBoundary'

const router = createBrowserRouter(routes)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <RepoProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </RepoProvider>
    </RootErrorBoundary>
  </StrictMode>,
)
