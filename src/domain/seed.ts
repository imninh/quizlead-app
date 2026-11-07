import type { Quiz, AiGhost } from './schemas.ts'
import { createId } from './id.ts'

export const SEED_GHOST: AiGhost = {
  model: 'qwen/qwen3.5-flash-02-23',
  ranAt: 1793904575484,
  answers: [
    { selectedIndex: 1, elapsedMs: 9121, modelLatencyMs: 901, readingMs: 8220 },
    { selectedIndex: 3, elapsedMs: 7949, modelLatencyMs: 989, readingMs: 6960 },
    { selectedIndex: 0, elapsedMs: 6873, modelLatencyMs: 1113, readingMs: 5760 },
    { selectedIndex: 2, elapsedMs: 9216, modelLatencyMs: 876, readingMs: 8340 },
    { selectedIndex: 1, elapsedMs: 8311, modelLatencyMs: 871, readingMs: 7440 },
  ],
}

export const DEFAULT_SETTINGS = {
  fanpageName: 'FPT Polytechnic',
  giftDescription: 'Voucher 50.000đ cho top 10',
  fanpageUrl: '',
}

export const SEED_QUIZ: Quiz = {
  id: 'seed-digital-marketing',
  title: 'Digital Marketing cơ bản',
  topic: 'Digital Marketing',
  questions: [
    {
      id: createId(),
      text: 'SEO là viết tắt của cụm từ nào?',
      options: [
        'Social Engine Optimization',
        'Search Engine Optimization',
        'Search Engagement Optimization',
        'Site Engine Optimization',
      ],
      correctIndex: 1,
      explanation: 'SEO = Search Engine Optimization, tối ưu hóa công cụ tìm kiếm.',
    },
    {
      id: createId(),
      text: 'KPI trong marketing là gì?',
      options: [
        'Key Product Index',
        'Keyword Performance Insight',
        'Known Purchase Intent',
        'Key Performance Indicator',
      ],
      correctIndex: 3,
      explanation: 'KPI = Key Performance Indicator, chỉ số đo hiệu suất.',
    },
    {
      id: createId(),
      text: 'CTR là viết tắt của?',
      options: ['Click-Through Rate', 'Cost-To-Reach', 'Conversion Tracking Rate', 'Content Traffic Ratio'],
      correctIndex: 0,
      explanation: 'CTR = Click-Through Rate, tỷ lệ nhấp chuột.',
    },
    {
      id: createId(),
      text: 'A/B testing dùng để làm gì?',
      options: [
        'Kiểm tra bảo mật hệ thống',
        'Mã hoá dữ liệu người dùng',
        'So sánh hai phiên bản để chọn hiệu quả hơn',
        'Giảm chi phí máy chủ',
      ],
      correctIndex: 2,
      explanation: 'A/B testing so sánh hai biến thể để tối ưu kết quả.',
    },
    {
      id: createId(),
      text: 'Conversion rate là?',
      options: [
        'Tốc độ tải trang',
        'Tỉ lệ người dùng thực hiện hành động mong muốn',
        'Số lượt xem trang',
        'Chi phí cho mỗi nhấp chuột',
      ],
      correctIndex: 1,
      explanation: 'Conversion rate = tỷ lệ chuyển đổi.',
    },
  ],
  source: 'manual',
  aiGhost: SEED_GHOST,
  createdAt: 0,
  updatedAt: 0,
}
