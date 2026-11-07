import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/Button'
import { PageLoader } from '../../components/PageLoader'
import { useRepo } from '../../hooks/useRepo'
import { fetchPublishedQuiz } from '../../services/onlineClient'
import type { Quiz } from '../../domain/schemas'
import PlayPage from './PlayPage'

export default function OnlineQuizPage() {
  const { quizId } = useParams()
  const navigate = useNavigate()
  const repo = useRepo()
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [error, setError] = useState(!quizId)

  useEffect(() => {
    let active = true
    if (!quizId) return
    fetchPublishedQuiz(quizId)
      .then((result) => {
        if (active) setQuiz(result.quiz)
      })
      .catch(() => {
        if (active) setError(true)
      })
    return () => {
      active = false
    }
  }, [quizId])

  if (error) {
    // Quiz có sẵn trên máy này (vd quản trị viên chưa xuất bản) thì vẫn cho chơi bản trên máy.
    const local = quizId ? repo.getQuiz(quizId) : null
    const hasLocal = !!local && local.ok
    return (
      <div className="mx-auto max-w-xl space-y-4 py-10 text-center">
        <h1 className="font-display text-3xl">Không tải được quiz</h1>
        <p>Quiz có thể chưa được xuất bản hoặc máy chủ đang bận.</p>
        <div className="flex flex-wrap justify-center gap-3">
          {hasLocal ? <Button onClick={() => navigate(`/play/${quizId}`)}>Chơi bản trên máy này</Button> : null}
          <Button variant={hasLocal ? 'secondary' : 'primary'} onClick={() => navigate('/')}>Về trang đầu</Button>
        </div>
      </div>
    )
  }

  if (!quiz) return <PageLoader />
  return <PlayPage quizOverride={quiz} online />
}
