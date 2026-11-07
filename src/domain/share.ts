import type { RaceResult } from './schemas.js'

export function buildShareText(params: {
  score: number
  correctCount: number
  totalTimeMs: number
  quizTitle: string
  fanpageName: string
  appUrl: string
  race?: { result: RaceResult; opponentLabel: string }
}): string {
  const seconds = Math.round(params.totalTimeMs / 1000)
  const hashtag = params.fanpageName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
  const scoreText = params.score.toLocaleString('vi-VN')
  const raceLine = params.race
    ? `\n🏁 ${
        params.race.result === 'win'
          ? `Mình đã thắng ${params.race.opponentLabel} trên đường đua!`
          : params.race.result === 'lose'
            ? `Mình đã thua ${params.race.opponentLabel} trên đường đua!`
            : `Mình hoà ${params.race.opponentLabel} trên đường đua!`
      }`
    : ''
  return `🎉 Mình vừa đạt ${scoreText} điểm (${params.correctCount}/5 câu đúng) trong minigame "${params.quizTitle}" của ${params.fanpageName}!\n⏱️ Thời gian: ${seconds} giây\nBạn có vượt qua được mình không? 👉 ${params.appUrl}${raceLine}\n#minigame #${hashtag}`
}