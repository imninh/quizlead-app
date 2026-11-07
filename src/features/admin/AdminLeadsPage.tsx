/* oxlint-disable-file react/set-state-in-effect, react-hooks/exhaustive-deps, react/purity */
import { useEffect, useState } from 'react'
import { useRepo, useRepoVersion } from '../../hooks/useRepo'
import { useOnlineService } from '../../hooks/useOnlineService'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { leadsToCsv } from '../../domain/csv'
import { MSG } from '../../domain/messages'
import type { Lead } from '../../domain/schemas'
import { deleteOnlineEntry, fetchOnlineLeaderboard, type OnlineEntry } from '../../services/onlineClient'

function removeDiacritics(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function formatDuration(ms: number): string {
  return `${Math.round(ms / 1000)} giây`
}

function formatDateTime(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Ho_Chi_Minh',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}

export default function AdminLeadsPage() {
  const repo = useRepo()
  useRepoVersion()
  const toast = useToast()
  const online = useOnlineService()
  const [search, setSearch] = useState('')
  const [quizFilter, setQuizFilter] = useState('')
  const [deleteAllOpen, setDeleteAllOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [onlineEntries, setOnlineEntries] = useState<OnlineEntry[]>([])
  const [onlineError, setOnlineError] = useState(false)
  const [deletingOnlineId, setDeletingOnlineId] = useState<string | null>(null)
  const [boardNote, setBoardNote] = useState<string | null>(null)

  const activeResult = repo.getActiveQuizId()
  const activeQuizId = activeResult.ok ? activeResult.data : null

  useEffect(() => {
    if (online !== true || !activeQuizId) return
    let active = true
    fetchOnlineLeaderboard(activeQuizId)
      .then((result) => {
        if (!active) return
        setOnlineEntries(result.entries)
        setOnlineError(false)
      })
      .catch(() => {
        if (active) setOnlineError(true)
      })
    return () => {
      active = false
    }
  }, [online, activeQuizId])

  const removeOnlineEntry = async (entry: OnlineEntry) => {
    const passcode = repo.getAdminPasscode()?.trim()
    if (!passcode) {
      toast.show('Nhập passcode ở Cài đặt trước')
      return
    }
    setDeletingOnlineId(entry.entryId)
    try {
      await deleteOnlineEntry(entry.quizId, entry.entryId, passcode)
      setOnlineEntries((current) => current.filter((item) => item.entryId !== entry.entryId))
      setBoardNote(MSG.onlineBoardRefreshing)
      toast.show('Đã xoá dòng online')
    } catch {
      toast.show('Không xoá được dòng online')
    } finally {
      setDeletingOnlineId(null)
    }
  }

  const quizzesResult = repo.getQuizzes()
  const quizzes = quizzesResult.ok ? quizzesResult.data : []
  const quizMap = new Map(quizzes.map((quiz) => [quiz.id, quiz.title]))
  const leadsResult = repo.getLeads()
  const leads = leadsResult.ok ? leadsResult.data : []
  const deletedQuizIds = [...new Set(leads.map((lead) => lead.quizId))].filter((id) => !quizMap.has(id))

  const filtered = (() => {
    const normalizedSearch = removeDiacritics(search)
    return leads.filter((lead: Lead) => {
      if (quizFilter && lead.quizId !== quizFilter) return false
      if (!search) return true
      const nameMatch = removeDiacritics(lead.name).includes(normalizedSearch)
      const phoneMatch = lead.phone.includes(search)
      return nameMatch || phoneMatch
    })
  })()

  // oxlint-disable-next-line react/purity
  const today = new Date().toDateString()
  const todayCount = leads.filter((lead) => new Date(lead.createdAt).toDateString() === today).length
  const avgScore = leads.length ? Math.round(leads.reduce((sum, lead) => sum + lead.totalScore, 0) / leads.length) : 0

  const doDelete = (id: string) => {
    const r = repo.deleteLead(id)
    setDeleteId(null)
    if (!r.ok) toast.show(r.error.message)
  }

  const doDeleteAll = () => {
    const r = repo.clearLeads()
    setDeleteAllOpen(false)
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    toast.show('Đã xoá tất cả lead')
  }

  const exportCsv = () => {
    const csv = leadsToCsv(filtered, new Map(quizzes.map((quiz) => [quiz.id, { title: quiz.title }])))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    a.download = `quizlead-leads-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h1 className="font-display text-3xl">Khách hàng</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={filtered.length === 0}>Xuất CSV</Button>
          <Button variant="ghost" onClick={() => setDeleteAllOpen(true)} disabled={leads.length === 0}>Xoá tất cả</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center"><div className="text-2xl font-bold">{leads.length}</div><div className="text-sm">Tổng lead</div></Card>
        <Card className="text-center"><div className="text-2xl font-bold">{todayCount}</div><div className="text-sm">Hôm nay</div></Card>
        <Card className="text-center"><div className="text-2xl font-bold">{avgScore}</div><div className="text-sm">Điểm TB</div></Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <input
          aria-label="Tìm tên hoặc SĐT"
          className="border-2 border-ink rounded-xl px-3 py-2 flex-1 min-w-[200px]"
          placeholder="Tìm tên hoặc SĐT"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select aria-label="Lọc theo quiz" className="border-2 border-ink rounded-xl px-3 py-2" value={quizFilter} onChange={(e) => setQuizFilter(e.target.value)}>
          <option value="">Tất cả quiz</option>
          {quizzes.map((quiz) => <option key={quiz.id} value={quiz.id}>{quiz.title}</option>)}
          {deletedQuizIds.map((id) => <option key={id} value={id}>(quiz đã xoá)</option>)}
        </select>
      </div>

      {leads.length === 0 ? (
        <Card><p>Chưa có khách hàng.</p></Card>
      ) : filtered.length === 0 ? (
        <Card><p>Không có khách hàng khớp tìm kiếm.</p></Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-ink/20">
                <th className="text-left py-2 px-3">Tên</th>
                <th className="text-left py-2 px-3">SĐT</th>
                <th className="text-left py-2 px-3">Quiz</th>
                <th className="text-right py-2 px-3">Điểm</th>
                <th className="text-right py-2 px-3">Câu đúng</th>
                <th className="text-right py-2 px-3">Thời gian</th>
                <th className="text-left py-2 px-3">Ngày giờ</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead) => (
                <tr key={lead.id} className="border-b border-ink/10">
                  <td className="py-2 px-3">{lead.name}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{lead.phone}</td>
                  <td className="py-2 px-3">{quizMap.get(lead.quizId) ?? '(quiz đã xoá)'}</td>
                  <td className="py-2 px-3 text-right">{lead.totalScore.toLocaleString('vi-VN')}</td>
                  <td className="py-2 px-3 text-right">{lead.correctCount}/5</td>
                  <td className="py-2 px-3 text-right whitespace-nowrap">{formatDuration(lead.totalTimeMs)}</td>
                  <td className="py-2 px-3 whitespace-nowrap">{formatDateTime(lead.createdAt)}</td>
                  <td className="py-2 px-3">
                    <button className="text-alert underline" onClick={() => setDeleteId(lead.id)}>Xoá</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {online === true ? (
        <Card className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">Bảng xếp hạng chung</h2>
            <span className="text-xs text-ink/60">Quiz đang chạy</span>
          </div>
          {onlineError ? <p className="text-sm text-alert">Không tải được bảng chung.</p> : null}
          {!onlineError && onlineEntries.length === 0 ? <p className="text-sm text-ink/60">Chưa có ai trên bảng chung.</p> : null}
          {boardNote ? <p className="text-xs text-ink/60">{boardNote}</p> : null}
          {onlineEntries.map((entry, index) => (
            <div key={entry.entryId} className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-1 text-sm">
              <span className="font-semibold">#{index + 1} {entry.name}</span>
              <span>{entry.phoneMasked}</span>
              <span className="font-bold">{entry.totalScore.toLocaleString('vi-VN')} điểm</span>
              <Button
                variant="ghost"
                disabled={deletingOnlineId === entry.entryId}
                onClick={() => void removeOnlineEntry(entry)}
              >
                {deletingOnlineId === entry.entryId ? 'Đang xoá…' : 'Xoá'}
              </Button>
            </div>
          ))}
        </Card>
      ) : null}

      <ConfirmDialog open={!!deleteId} title="Xoá lead?" message="Không thể hoàn tác." danger confirmLabel="Xoá" onConfirm={() => deleteId && doDelete(deleteId)} onCancel={() => setDeleteId(null)} />
      <ConfirmDialog open={deleteAllOpen} title="Xoá tất cả lead?" message="Gõ XOA để xác nhận." danger requireText="XOA" confirmLabel="Xoá tất cả" onConfirm={doDeleteAll} onCancel={() => setDeleteAllOpen(false)} />
    </div>
  )
}
