import type { Quiz } from './schemas'
import { SEED_QUIZ } from './seed'

/**
 * Quiz trên máy có bản giống hệt trên máy chủ không (để chơi qua link online và lên bảng chung).
 * - Đã xuất bản và chưa sửa sau lần xuất bản gần nhất.
 * - Hoặc là quiz mẫu chưa bị sửa (máy chủ luôn có sẵn quiz mẫu).
 */
export function canPlayOnline(quiz: Quiz): boolean {
  if (quiz.publishedVersion !== undefined) {
    return quiz.publishedAt === undefined || quiz.updatedAt <= quiz.publishedAt
  }
  return quiz.id === SEED_QUIZ.id && quiz.updatedAt === SEED_QUIZ.updatedAt
}
