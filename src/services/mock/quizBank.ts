import type { Question } from '../../domain/schemas'

type Bank = { keywords: string[]; questions: Question[] }

const marketing: Question[] = [
  // Đúng: A
  { id: 'm1', text: 'SEO là viết tắt của cụm từ nào?', options: ['Search Engine Optimization', 'Social Engine Optimization', 'Search Engagement Optimization', 'Site Engine Optimization'], correctIndex: 0, explanation: 'SEO = Search Engine Optimization, tối ưu hoá công cụ tìm kiếm.' },
  // Đúng: B
  { id: 'm2', text: 'KPI là viết tắt của cụm từ nào?', options: ['Key Product Index', 'Key Performance Indicator', 'Keyword Performance Insight', 'Known Purchase Intent'], correctIndex: 1, explanation: 'KPI = Key Performance Indicator, chỉ số đo hiệu suất.' },
  // Đúng: C
  { id: 'm3', text: 'CTR là viết tắt của cụm từ nào?', options: ['Cost-To-Reach', 'Content Traffic Ratio', 'Click-Through Rate', 'Conversion Tracking Rate'], correctIndex: 2, explanation: 'CTR = Click-Through Rate, tỉ lệ nhấp chuột.' },
  // Đúng: D
  { id: 'm4', text: 'Kênh nào sau đây là mạng xã hội?', options: ['Email', 'SEO', 'Banner quảng cáo', 'Facebook'], correctIndex: 3, explanation: 'Facebook là một mạng xã hội.' },
  // Đúng: A
  { id: 'm5', text: 'Conversion rate là gì?', options: ['Tỉ lệ người dùng thực hiện hành động mong muốn', 'Tốc độ tải trang', 'Số lượt xem trang', 'Chi phí cho mỗi nhấp chuột'], correctIndex: 0, explanation: 'Conversion rate = tỉ lệ chuyển đổi.' },
]

const tech: Question[] = [
  // Đúng: B
  { id: 't1', text: 'AI là viết tắt của cụm từ nào?', options: ['Automated Internet', 'Artificial Intelligence', 'Advanced Interface', 'Applied Innovation'], correctIndex: 1, explanation: 'AI = Artificial Intelligence, trí tuệ nhân tạo.' },
  // Đúng: C
  { id: 't2', text: 'HTML dùng để làm gì?', options: ['Lập trình server', 'Quản lý cơ sở dữ liệu', 'Mô tả cấu trúc trang web', 'Thiết kế đồ hoạ'], correctIndex: 2, explanation: 'HTML mô tả cấu trúc nội dung trang web.' },
  // Đúng: D
  { id: 't3', text: 'CSS dùng để làm gì?', options: ['Xử lý dữ liệu', 'Lưu trữ dữ liệu', 'Gửi email', 'Tạo kiểu dáng giao diện'], correctIndex: 3, explanation: 'CSS tạo kiểu dáng cho giao diện.' },
  // Đúng: A
  { id: 't4', text: 'JavaScript có thể chạy ở đâu?', options: ['Cả trình duyệt và server', 'Chỉ server', 'Chỉ cơ sở dữ liệu', 'Chỉ trình duyệt'], correctIndex: 0, explanation: 'JavaScript chạy được ở cả trình duyệt và server.' },
  // Đúng: B
  { id: 't5', text: 'API là gì?', options: ['Ứng dụng chỉnh ảnh', 'Giao diện lập trình ứng dụng', 'Thiết bị mạng', 'Ngôn ngữ đánh dấu'], correctIndex: 1, explanation: 'API = Application Programming Interface.' },
]

const food: Question[] = [
  // Đúng: C
  { id: 'f1', text: 'Phở là món ăn truyền thống của nước nào?', options: ['Thái Lan', 'Nhật Bản', 'Việt Nam', 'Hàn Quốc'], correctIndex: 2, explanation: 'Phở là món ăn truyền thống của Việt Nam.' },
  // Đúng: D
  { id: 'f2', text: 'Bánh chưng thường được gói bằng lá gì?', options: ['Lá chuối', 'Lá cọ', 'Lá tre', 'Lá dong'], correctIndex: 3, explanation: 'Bánh chưng thường được gói bằng lá dong.' },
  // Đúng: A
  { id: 'f3', text: 'Nước mắm được làm từ nguyên liệu chính nào?', options: ['Cá cơm lên men', 'Thịt bò', 'Gạo nếp', 'Đậu nành'], correctIndex: 0, explanation: 'Nước mắm truyền thống làm từ cá cơm lên men.' },
  // Đúng: B
  { id: 'f4', text: 'Bánh mì Việt Nam chịu ảnh hưởng từ ẩm thực nước nào?', options: ['Nhật Bản', 'Pháp', 'Trung Quốc', 'Hàn Quốc'], correctIndex: 1, explanation: 'Bánh mì Việt Nam chịu ảnh hưởng từ ẩm thực Pháp.' },
  // Đúng: C
  { id: 'f5', text: 'Cơm tấm là món ăn đặc trưng của vùng nào?', options: ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Tây Nguyên'], correctIndex: 2, explanation: 'Cơm tấm là món ăn đặc trưng của miền Nam.' },
]

const general: Question[] = [
  // Đúng: D
  { id: 'g1', text: 'Thủ đô của Việt Nam là thành phố nào?', options: ['Huế', 'Đà Nẵng', 'Hải Phòng', 'Hà Nội'], correctIndex: 3, explanation: 'Hà Nội là thủ đô của Việt Nam.' },
  // Đúng: A
  { id: 'g2', text: 'Hành tinh nào gần Mặt Trời nhất?', options: ['Sao Thuỷ', 'Sao Kim', 'Trái Đất', 'Sao Hoả'], correctIndex: 0, explanation: 'Sao Thuỷ là hành tinh gần Mặt Trời nhất.' },
  // Đúng: B
  { id: 'g3', text: 'Trái Đất quay quanh thiên thể nào?', options: ['Mặt Trăng', 'Mặt Trời', 'Sao Hoả', 'Sao Kim'], correctIndex: 1, explanation: 'Trái Đất quay quanh Mặt Trời.' },
  // Đúng: C
  { id: 'g4', text: 'Năm nhuận có bao nhiêu ngày?', options: ['364', '365', '366', '367'], correctIndex: 2, explanation: 'Năm nhuận có 366 ngày.' },
  // Đúng: D
  { id: 'g5', text: 'Ai là tác giả của Truyện Kiều?', options: ['Hồ Xuân Hương', 'Nam Cao', 'Tô Hoài', 'Nguyễn Du'], correctIndex: 3, explanation: 'Nguyễn Du là tác giả của Truyện Kiều.' },
]

const banks: Bank[] = [
  { keywords: ['marketing', 'digital', 'seo', 'quang cao'], questions: marketing },
  { keywords: ['cong nghe', 'ai', 'lap trinh', 'technology'], questions: tech },
  { keywords: ['am thuc', 'mon an', 'food', 'mon pho'], questions: food },
  { keywords: ['chung', 'general', 'kien thuc'], questions: general },
]

function tokenize(value: string): string[] {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

function hasPhrase(topicTokens: string[], keyword: string): boolean {
  const keywordTokens = tokenize(keyword)
  if (keywordTokens.length === 0 || keywordTokens.length > topicTokens.length) return false
  for (let i = 0; i <= topicTokens.length - keywordTokens.length; i++) {
    if (keywordTokens.every((token, j) => topicTokens[i + j] === token)) return true
  }
  return false
}

export function pickQuestions(topic: string): Question[] {
  const topicTokens = tokenize(topic)
  const bank =
    banks.find((candidate) => candidate.keywords.some((keyword) => hasPhrase(topicTokens, keyword))) ??
    banks[3]!
  return bank.questions.map((question) => ({ ...question }))
}
