import type { Lead } from './schemas.ts'

export function leadsToCsv(leads: Lead[], quizzesById: Map<string, { title: string }>): string {
  const header = ['Tên', 'SĐT', 'Quiz', 'Điểm', 'Số câu đúng', 'Thời gian (giây)', 'Ngày giờ']
  const rows = [header.map(escapeCell).join(',')]
  for (const lead of leads) {
    const quizTitle = quizzesById.get(lead.quizId)?.title ?? '(quiz đã xoá)'
    const row = [
      lead.name,
      lead.phone,
      quizTitle,
      String(lead.totalScore),
      String(lead.correctCount),
      String(Math.round(lead.totalTimeMs / 1000)),
      formatDateTime(lead.createdAt),
    ]
    rows.push(row.map(escapeCell).join(','))
  }
  return '\uFEFF' + rows.join('\r\n')
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
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`
}

function escapeCell(value: string): string {
  let v = value
  if (/^[=+\-@\t\r]/.test(v)) v = "'" + v
  if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"'
  return v
}