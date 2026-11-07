import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate, Link, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import { useRepo } from '../../hooks/useRepo'
import { useOnlineService } from '../../hooks/useOnlineService'
import { topLeads, findRank } from '../../domain/leaderboard'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { CharacterImage } from '../../components/CharacterImage'
import { RaceCharacter } from '../../components/RaceCharacter'
import { Doodle } from '../../components/Doodle'
import { EmptyState } from '../../components/EmptyState'
import { BrushStroke } from '../../components/BrushStroke'
import { MSG } from '../../domain/messages'
import { OnlineError, fetchOnlineLeaderboard, fetchPublishedQuiz, loadOnlineEntry, loadOnlineEntryId, mergeOnlineEntries, type OnlineEntry } from '../../services/onlineClient'
import type { Lead, Quiz } from '../../domain/schemas'

type Tab = 'online' | 'local'

function Row({
  rank,
  name,
  character,
  phone,
  score,
  timeMs,
  highlight,
  raceWonAi,
  index,
}: {
  rank: number
  name: string
  character?: Lead['character']
  phone: string
  score: number
  timeMs: number
  highlight: boolean
  raceWonAi: boolean
  index: number
}) {
  const reduced = useReducedMotion()
  const medal = (i: number) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '')
  return (
    <motion.tr
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
      animate={highlight && !reduced ? { opacity: [1, 0.5, 1, 0.5, 1], y: 0 } : { opacity: 1, y: 0 }}
      transition={{ delay: reduced ? 0 : index * 0.06, duration: highlight && !reduced ? 0.9 : reduced ? 0.12 : 0.35 }}
      className={`border-b border-ink/15 ${highlight ? 'bg-sun/50' : index % 2 === 0 ? 'bg-white/70' : 'bg-paper/60'}`}
    >
      <td className="whitespace-nowrap px-2 py-3 font-semibold sm:px-3">
        <span className="mr-1">{medal(rank - 1)}</span>
        {rank}
        {rank <= 3 ? <Doodle kind="crown" size={18} color="var(--color-alert)" className="ml-1 inline-block align-middle" /> : null}
      </td>
      <td className="px-2 py-3 sm:px-3">
        <div className="font-medium">{name}</div>
        <div className="text-xs text-ink/60 sm:hidden">{Math.round(timeMs / 1000)} giây</div>
        {raceWonAi ? <div className="text-[11px] font-semibold text-cobalt">🏁 thắng Trùm</div> : null}
      </td>
      <td className="px-1 py-3">
        {character ? <RaceCharacter character={character} className="h-6 w-6" /> : null}
      </td>
      <td className="whitespace-nowrap px-2 py-3 text-[11px] sm:px-3 sm:text-sm">{phone}</td>
      <td className="whitespace-nowrap px-2 py-3 text-right font-bold sm:px-3">{score.toLocaleString('vi-VN')}</td>
      <td className="hidden whitespace-nowrap px-2 py-3 text-right sm:table-cell sm:px-3">{Math.round(timeMs / 1000)}s</td>
    </motion.tr>
  )
}

export default function LeaderboardPage() {
  const { quizId } = useParams()
  const [searchParams] = useSearchParams()
  const highlight = searchParams.get('highlight')
  const navigate = useNavigate()
  const repo = useRepo()
  const online = useOnlineService()
  const [tab, setTab] = useState<Tab | null>(null)
  const [onlineEntries, setOnlineEntries] = useState<OnlineEntry[]>([])
  // 'unpublished': quiz chưa xuất bản nên không có bảng chung; 'error': máy chủ lỗi tạm thời.
  const [onlineIssue, setOnlineIssue] = useState<'unpublished' | 'error' | null>(null)
  const [remoteQuiz, setRemoteQuiz] = useState<Quiz | null>(null)

  const quizResult = quizId ? repo.getQuiz(quizId) : null
  const quiz = quizResult && quizResult.ok ? quizResult.data : null
  const displayQuiz = quiz ?? remoteQuiz

  useEffect(() => {
    if (!quizId || quiz || online !== true) return
    let active = true
    fetchPublishedQuiz(quizId)
      .then((result) => {
        if (active) setRemoteQuiz(result.quiz)
      })
      .catch(() => {
        // Không tải được quiz online thì rơi về trạng thái "quiz đã bị xoá".
      })
    return () => {
      active = false
    }
  }, [quizId, quiz, online])
  const leadsResult = repo.getLeads()
  const leads = leadsResult.ok ? leadsResult.data : []
  const ranked = quizId ? topLeads(leads, quizId, 10) : []
  const inTop = highlight ? ranked.some((l) => l.id === highlight) : false
  const userRank = highlight && quizId ? findRank(leads, quizId, highlight) : null
  const myOnlineId = loadOnlineEntryId()
  const myOnlineEntry = quizId ? loadOnlineEntry(quizId) : null
  const onlineRanked = mergeOnlineEntries(onlineEntries, myOnlineEntry)

  useEffect(() => {
    if (!quizId || online !== true) return
    let active = true
    fetchOnlineLeaderboard(quizId)
      .then((result) => {
        if (!active) return
        setOnlineEntries(result.entries)
        setOnlineIssue(null)
      })
      .catch((error: unknown) => {
        if (!active) return
        setOnlineIssue(error instanceof OnlineError && error.code === 'NOT_FOUND' ? 'unpublished' : 'error')
        setTab('local')
      })
    return () => {
      active = false
    }
  }, [quizId, online])

  if (!quizId || !displayQuiz) {
    return (
      <EmptyState
        title="Quiz này đã bị xoá"
        actionLabel="Về trang đầu"
        onAction={() => navigate('/')}
        character="muc-tangled"
        note={MSG.handCheer}
      />
    )
  }

  const hasOnlineBoard = online === true && onlineIssue !== 'unpublished'
  const activeTab: Tab = hasOnlineBoard ? (tab ?? 'online') : 'local'
  const localRanked = ranked
  const showEmpty = activeTab === 'online' ? onlineRanked.length === 0 : localRanked.length === 0
  // Chỉ dẫn sang link online khi bảng chung tải được; còn lại chơi bằng quiz trên máy.
  const playHref = hasOnlineBoard && onlineIssue === null && activeTab === 'online' ? `/q/${quizId}` : `/play/${quizId}`

  return (
    <div className="relative mx-auto max-w-5xl">
      <Doodle kind="star" size={52} color="var(--color-sun)" className="absolute -left-2 top-10 hidden opacity-70 lg:block" />
      <div className="mb-4 flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
        <h1 className="relative font-display text-[clamp(2rem,6vw,3.6rem)] leading-none">
          <BrushStroke color="var(--color-sky)" className="-inset-x-3 bottom-0 h-4 w-[calc(100%+1.5rem)] opacity-70" />
          <span className="display-tilt relative">Bảng xếp hạng</span>
        </h1>
        <p className="text-lg font-semibold">{displayQuiz.title}</p>
      </div>

      {hasOnlineBoard ? (
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Nguồn bảng xếp hạng">
          <button
            role="tab"
            aria-selected={activeTab === 'online'}
            className={`inline-flex min-h-[44px] items-center rounded-xl border-2 border-ink px-3 py-2 text-sm font-semibold ${activeTab === 'online' ? 'bg-sun shadow-sticker' : 'bg-white/70'}`}
            onClick={() => setTab('online')}
          >
            Toàn bộ người chơi (online)
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'local'}
            className={`inline-flex min-h-[44px] items-center rounded-xl border-2 border-ink px-3 py-2 text-sm font-semibold ${activeTab === 'local' ? 'bg-sun shadow-sticker' : 'bg-white/70'}`}
            onClick={() => setTab('local')}
          >
            Trên máy này
          </button>
        </div>
      ) : null}

      {onlineIssue === 'unpublished' ? (
        <p className="mb-2 text-sm text-ink/70">Quiz này chưa xuất bản lên bảng chung. Đang hiển thị bảng trên máy này.</p>
      ) : null}
      {onlineIssue === 'error' ? <p className="mb-2 text-sm text-ink/70">Không tải được bảng chung. Đang hiển thị trên máy này.</p> : null}

      {showEmpty ? (
        <EmptyState
          title={activeTab === 'online' ? 'Chưa có ai trên bảng chung' : 'Chưa có ai trên bảng, bạn sẽ là người đầu tiên!'}
          actionLabel={activeTab === 'online' ? 'Chơi ngay' : 'Chơi ngay'}
          onAction={() => navigate(playHref)}
          note={MSG.handGo}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
          <Card className="overflow-hidden !p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="border-b-2 border-ink bg-sun/50">
                    <th className="whitespace-nowrap px-2 py-3 text-left font-display text-base tracking-wide sm:px-3 sm:text-lg">Hạng</th>
                    <th className="px-2 py-3 text-left font-display text-base tracking-wide sm:px-3 sm:text-lg">Tên</th>
                    <th className="w-8 px-1 py-3"><span className="sr-only">Nhân vật</span></th>
                    <th className="whitespace-nowrap px-2 py-3 text-left font-display text-base tracking-wide sm:px-3 sm:text-lg">SĐT</th>
                    <th className="whitespace-nowrap px-2 py-3 text-right font-display text-base tracking-wide sm:px-3 sm:text-lg">Điểm</th>
                    <th className="hidden whitespace-nowrap px-2 py-3 text-right font-display text-base tracking-wide sm:table-cell sm:px-3 sm:text-lg">Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {activeTab === 'online'
                    ? onlineRanked.map((entry, index) => (
                        <Row
                          key={entry.entryId}
                          rank={index + 1}
                          name={entry.name}
                          character={entry.character}
                          phone={entry.phoneMasked}
                          score={entry.totalScore}
                          timeMs={entry.totalTimeMs}
                          highlight={!!myOnlineId && entry.entryId === myOnlineId}
                          raceWonAi={entry.raceResult === 'win' && entry.opponent?.kind === 'ai'}
                          index={index}
                        />
                      ))
                    : localRanked.map((lead, index) => (
                        <Row
                          key={lead.id}
                          rank={index + 1}
                          name={lead.name}
                          character={lead.character}
                          phone={`${lead.phone.slice(0, 2)}******${lead.phone.slice(-2)}`}
                          score={lead.totalScore}
                          timeMs={lead.totalTimeMs}
                          highlight={highlight === lead.id}
                          raceWonAi={lead.raceResult === 'win' && lead.opponentKind === 'ai'}
                          index={index}
                        />
                      ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-3">
            <CharacterImage name="mi-trophy" priority sizes="(min-width: 640px) 224px, 176px" className="mx-auto h-44 w-auto object-contain sm:h-56" />
            {activeTab === 'local' && !inTop && userRank ? (
              <Card>
                <p className="text-center font-semibold">Hạng của bạn: #{userRank}</p>
              </Card>
            ) : null}
            <div className="flex justify-center">
              <Link to={playHref}><Button>{MSG.playAgain}</Button></Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
