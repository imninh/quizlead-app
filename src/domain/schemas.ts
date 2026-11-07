import { z } from 'zod'

export const QuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  options: z.tuple([z.string(), z.string(), z.string(), z.string()]),
  correctIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  explanation: z.string().optional(),
})

export const QuizSourceSchema = z.enum(['manual', 'ai', 'mixed'])
export const CharacterSchema = z.enum(['mi', 'bin', 'muc'])
export const OpponentKindSchema = z.enum(['ai', 'cheetah', 'rabbit', 'turtle'])
export const RaceResultSchema = z.enum(['win', 'lose', 'draw'])

export const ProfileSchema = z.object({
  name: z.string(),
  character: CharacterSchema,
})

export const AiGhostAnswerSchema = z.object({
  selectedIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.null()]),
  elapsedMs: z.number(),
  modelLatencyMs: z.number().optional(),
  readingMs: z.number().optional(),
})

export const AiGhostSchema = z.object({
  model: z.string(),
  ranAt: z.number(),
  answers: z.array(AiGhostAnswerSchema).length(5),
})

export const QuizSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic: z.string().optional(),
  questions: z.array(QuestionSchema).length(5),
  source: QuizSourceSchema,
  aiGhost: AiGhostSchema.optional(),
  publishedVersion: z.number().optional(),
  publishedAt: z.number().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const AnswerRecordSchema = z.object({
  questionId: z.string(),
  selectedIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.null()]),
  elapsedMs: z.number(),
  isCorrect: z.boolean(),
  points: z.number(),
})

export const AttemptSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  answers: z.array(AnswerRecordSchema).length(5),
  totalScore: z.number(),
  correctCount: z.number(),
  totalTimeMs: z.number(),
  finishedAt: z.number(),
  opponent: z
    .object({
      kind: OpponentKindSchema,
      model: z.string().optional(),
      totalScore: z.number(),
      totalTimeMs: z.number(),
    })
    .optional(),
  raceResult: RaceResultSchema.optional(),
  online: z.boolean().optional(),
})

export const LeadSchema = z.object({
  id: z.string(),
  quizId: z.string(),
  attemptId: z.string(),
  name: z.string(),
  phone: z.string(),
  consent: z.literal(true),
  totalScore: z.number(),
  correctCount: z.number(),
  totalTimeMs: z.number(),
  createdAt: z.number(),
  character: CharacterSchema.optional(),
  raceResult: RaceResultSchema.optional(),
  opponentKind: OpponentKindSchema.optional(),
})

export const SettingsSchema = z.object({
  fanpageName: z.string(),
  giftDescription: z.string(),
  fanpageUrl: z.string().optional().default(''),
})

export const AiDifficultySchema = z.enum(['easy', 'medium', 'hard'])

export const AiQuizRequestSchema = z.object({
  topic: z.string().trim().min(3).max(100),
  difficulty: AiDifficultySchema,
  language: z.literal('vi'),
})

export const AiQuizResponseSchema = z.union([
  z.object({ questions: z.array(QuestionSchema).length(5) }),
  z.object({ error: z.literal('inappropriate_topic') }),
])

export type Question = z.infer<typeof QuestionSchema>
export type Quiz = z.infer<typeof QuizSchema>
export type AnswerRecord = z.infer<typeof AnswerRecordSchema>
export type Attempt = z.infer<typeof AttemptSchema>
export type Lead = z.infer<typeof LeadSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type Profile = z.infer<typeof ProfileSchema>
export type Character = z.infer<typeof CharacterSchema>
export type OpponentKind = z.infer<typeof OpponentKindSchema>
export type AiGhost = z.infer<typeof AiGhostSchema>
export type RaceResult = z.infer<typeof RaceResultSchema>
export type AiQuizRequest = z.infer<typeof AiQuizRequestSchema>
export const GameStatusSchema = z.enum(['idle', 'question', 'feedback', 'finished'])

export const GameStateSchema = z.object({
  status: GameStatusSchema,
  quiz: QuizSchema.nullable(),
  questionIndex: z.number(),
  deadline: z.number().nullable(),
  revealUntil: z.number().nullable().optional().default(null),
  feedbackUntil: z.number().nullable(),
  answers: z.array(AnswerRecordSchema),
  attemptId: z.string().nullable().optional().default(null),
  opponent: z
    .object({
      kind: OpponentKindSchema,
      model: z.string().optional(),
      answers: z.array(AnswerRecordSchema).length(5),
    })
    .nullable()
    .optional()
    .default(null),
})

export type GameStatus = z.infer<typeof GameStatusSchema>
