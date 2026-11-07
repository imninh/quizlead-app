import { EmptyState } from '../../components/EmptyState'

export default function NotFound() {
  return (
    <EmptyState
      title="404 — Không tìm thấy trang."
      actionLabel="Về trang đầu"
      onAction={() => window.location.assign('/')}
      note="Lạc đường rồi!"
    />
  )
}
