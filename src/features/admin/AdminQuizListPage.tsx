/* oxlint-disable-file react/set-state-in-effect, react-hooks/exhaustive-deps, react/purity */
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useRepo, useRepoVersion } from '../../hooks/useRepo'
import { useOnlineService } from '../../hooks/useOnlineService'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog, Badge } from '../../components/ConfirmDialog'
import type { Quiz } from '../../domain/schemas'
import { runGhost } from '../../services/aiClient'
import { publishQuiz } from '../../services/onlineClient'
import { copyText } from '../../services/clipboard'

export default function AdminQuizListPage() {
  const repo = useRepo()
  const version = useRepoVersion()
  const online = useOnlineService()
  const navigate = useNavigate()
  const toast = useToast()
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [leadsCount, setLeadsCount] = useState<Record<string, number>>({})
  const [runningGhostId, setRunningGhostId] = useState<string | null>(null)
  const [publishingId, setPublishingId] = useState<string | null>(null)

  const refresh = () => {
    const r = repo.getQuizzes()
    setQuizzes(r.ok ? r.data : [])
    const a = repo.getActiveQuizId()
    setActiveId(a.ok ? a.data : null)
    const leadsResult = repo.getLeads()
    const leads = leadsResult.ok ? leadsResult.data : []
    const counts: Record<string, number> = {}
    for (const l of leads) counts[l.quizId] = (counts[l.quizId] ?? 0) + 1
    setLeadsCount(counts)
  }

  // oxlint-disable-next-line react/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { refresh() }, [repo, version])

  const sourceLabel = (s: Quiz['source']) => (s === 'manual' ? 'Nhập tay' : s === 'ai' ? 'AI gợi ý' : 'AI + chỉnh sửa')

  const doDelete = () => {
    if (!deleteId) return
    const r = repo.deleteQuiz(deleteId)
    setDeleteId(null)
    if (!r.ok) toast.show(r.error.message)
    refresh()
  }

  const setActive = (id: string) => {
    const r = repo.setActiveQuizId(id)
    if (!r.ok) toast.show(r.error.message)
    refresh()
  }

  const restoreSeed = () => {
    const r = repo.restoreSeedQuiz()
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    toast.show('Đã thêm lại quiz mẫu')
    refresh()
  }

  const ghostLabel = (quiz: Quiz): string => {
    if (!quiz.aiGhost) return 'AI đối thủ: chưa có'
    const correct = quiz.aiGhost.answers.filter(
      (answer, index) => answer.selectedIndex !== null && answer.selectedIndex === quiz.questions[index]?.correctIndex,
    ).length
    const model = quiz.aiGhost.model.split('/').pop() ?? quiz.aiGhost.model
    return `AI đối thủ: sẵn sàng (${model}, ${correct}/5 đúng)`
  }

  const runGhostForQuiz = async (quiz: Quiz) => {
    setRunningGhostId(quiz.id)
    try {
      const ghost = await runGhost(quiz)
      const current = repo.getQuiz(quiz.id)
      if (current.ok) repo.saveQuiz({ ...current.data, aiGhost: ghost })
      toast.show('Đã cho AI chạy lại')
      refresh()
    } catch {
      toast.show('Không chạy được AI đối thủ')
    } finally {
      setRunningGhostId(null)
    }
  }

  const publish = async (quiz: Quiz) => {
    const passcode = repo.getAdminPasscode()?.trim()
    if (!passcode) {
      toast.show('Nhập passcode ở Cài đặt trước khi xuất bản')
      return
    }
    setPublishingId(quiz.id)
    try {
      const result = await publishQuiz(quiz, passcode)
      repo.saveQuiz({ ...quiz, publishedVersion: result.version, publishedAt: Date.now() })
      toast.show(`Đã xuất bản v${result.version}`)
      refresh()
    } catch {
      toast.show('Không xuất bản được quiz')
    } finally {
      setPublishingId(null)
    }
  }

  const copyPlayLink = async (quiz: Quiz) => {
    const result = await copyText(`${window.location.origin}/q/${quiz.id}`)
    toast.show(result.ok ? 'Đã copy link chơi' : 'Không copy được link')
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="font-display text-3xl">Quiz</h1>
        <Button onClick={() => navigate('/admin/quiz/new')}>+ Tạo quiz mới</Button>
      </div>
      {quizzes.length === 0 ? (
        <div className="text-center py-12 space-y-4">
          <p className="text-lg font-semibold">Chưa có quiz nào</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button onClick={() => navigate('/admin/quiz/new')}>Tạo quiz mới</Button>
            <Button variant="secondary" onClick={restoreSeed}>Khôi phục quiz mẫu</Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {quizzes.map((q) => (
            <Card key={q.id} className="space-y-2">
              <div className="flex justify-between items-start">
                <h2 className="font-semibold">{q.title}</h2>
                {activeId === q.id ? <Badge>Đang chạy</Badge> : null}
              </div>
              {q.topic ? <p className="text-sm text-ink/60">{q.topic}</p> : null}
              <div className="flex gap-2 flex-wrap">
                <Badge>{sourceLabel(q.source)}</Badge>
                <Badge>{leadsCount[q.id] ?? 0} lead</Badge>
              </div>
              <p className="text-xs text-ink/70">{ghostLabel(q)}</p>
              {online ? (
                <div className="space-y-1 rounded-xl border border-ink/10 bg-paper/70 p-2">
                  {q.publishedVersion ? (
                    <>
                      <p className="text-xs font-semibold">Đã xuất bản · v{q.publishedVersion}</p>
                      {q.publishedAt && q.updatedAt > q.publishedAt ? (
                        <p className="text-xs font-semibold text-alert">Có thay đổi chưa xuất bản</p>
                      ) : null}
                      <Button variant="ghost" onClick={() => void copyPlayLink(q)}>Copy link chơi</Button>
                    </>
                  ) : (
                    <p className="text-xs text-ink/60">Chưa xuất bản lên bảng chung</p>
                  )}
                  <Button
                    variant="secondary"
                    disabled={publishingId === q.id}
                    onClick={() => void publish(q)}
                  >
                    {publishingId === q.id ? 'Đang xuất bản…' : q.publishedVersion ? 'Xuất bản lại' : 'Xuất bản'}
                  </Button>
                </div>
              ) : null}
              <p className="text-xs text-ink/60">{new Date(q.createdAt).toLocaleDateString('vi-VN')}</p>
              <div className="flex gap-2 flex-wrap">
                <Link to={`/play/${q.id}`}><Button variant="secondary">Chơi thử</Button></Link>
                <Link to={`/admin/quiz/${q.id}/edit`}><Button variant="secondary">Sửa</Button></Link>
                <Button
                  variant="ghost"
                  disabled={runningGhostId === q.id}
                  onClick={() => void runGhostForQuiz(q)}
                >
                  {runningGhostId === q.id ? 'AI đang chạy…' : 'Cho AI chạy lại'}
                </Button>
                {activeId !== q.id ? <Button variant="ghost" onClick={() => setActive(q.id)}>Đặt làm đang chạy</Button> : null}
                <Button variant="ghost" onClick={() => setDeleteId(q.id)}>Xoá</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={!!deleteId}
        title="Xoá quiz?"
        message="Lead của quiz vẫn được giữ. Nếu đây là quiz đang chạy, quiz mới nhất còn lại sẽ thay thế."
        danger
        confirmLabel="Xoá"
        onConfirm={doDelete}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}
