/* oxlint-disable-file react/set-state-in-effect, react-hooks/exhaustive-deps, react/purity */
import { useEffect, useState } from 'react'
import { useRepo, useRepoVersion } from '../../hooks/useRepo'
import { useOnlineService } from '../../hooks/useOnlineService'
import { useToast } from '../../components/Toast'
import { Button } from '../../components/Button'
import { Card } from '../../components/Card'
import { TextField } from '../../components/TextField'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { DEFAULT_SETTINGS } from '../../domain/seed'
import { checkAdminPasscode } from '../../services/onlineClient'
import type { BackupInfo, StorageUsage } from '../../services/storage'

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

function formatTime(ms: number): string {
  return ms > 0 ? new Date(ms).toLocaleString('vi-VN') : 'Không rõ thời điểm'
}

export default function AdminSettingsPage() {
  const repo = useRepo()
  const version = useRepoVersion()
  const toast = useToast()
  const online = useOnlineService()
  const [passcode, setPasscode] = useState(() => repo.getAdminPasscode() ?? '')
  const [passcodeMessage, setPasscodeMessage] = useState<string | null>(null)
  const [fanpageName, setFanpageName] = useState('')
  const [giftDescription, setGiftDescription] = useState('')
  const [fanpageUrl, setFanpageUrl] = useState('')
  const [errors, setErrors] = useState<{ fanpageName?: string; giftDescription?: string; fanpageUrl?: string }>({})
  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [usage, setUsage] = useState<StorageUsage>({ bytes: 0, keys: 0 })
  const [deleteBackupKey, setDeleteBackupKey] = useState<string | null>(null)
  const [clearBackupsOpen, setClearBackupsOpen] = useState(false)

  const refreshData = () => {
    setBackups(repo.listBackups())
    setUsage(repo.getStorageUsage())
  }

  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    const r = repo.getSettings()
    const s = r.ok ? r.data : DEFAULT_SETTINGS
    // oxlint-disable-next-line react/set-state-in-effect
    setFanpageName(s.fanpageName)
    setGiftDescription(s.giftDescription)
    setFanpageUrl(s.fanpageUrl ?? '')
    refreshData()
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [repo, version])

  const validate = () => {
    const next: { fanpageName?: string; giftDescription?: string; fanpageUrl?: string } = {}
    if (fanpageName.trim().length < 2 || fanpageName.trim().length > 50) next.fanpageName = 'Tên fanpage từ 2 đến 50 ký tự'
    if (giftDescription.trim().length > 120) next.giftDescription = 'Mô tả quà tối đa 120 ký tự'
    if (fanpageUrl.trim()) {
      try {
        const u = new URL(fanpageUrl.trim())
        if (u.protocol !== 'https:' || (!u.hostname.includes('facebook.com') && !u.hostname.includes('fb.com'))) {
          next.fanpageUrl = 'Link phải là https:// facebook.com hoặc fb.com'
        }
      } catch {
        next.fanpageUrl = 'Link không hợp lệ'
      }
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const save = () => {
    if (!validate()) return
    const r = repo.saveSettings({ fanpageName: fanpageName.trim(), giftDescription: giftDescription.trim(), fanpageUrl: fanpageUrl.trim() })
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    toast.show('Đã lưu cài đặt')
  }

  const reset = () => {
    setFanpageName(DEFAULT_SETTINGS.fanpageName)
    setGiftDescription(DEFAULT_SETTINGS.giftDescription)
    setFanpageUrl(DEFAULT_SETTINGS.fanpageUrl)
  }

  const downloadBackup = (backup: BackupInfo) => {
    const content = repo.getBackupContent(backup.key)
    if (content === null) {
      toast.show('Không đọc được bản sao lưu')
      return
    }
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `quizlead-backup-${backup.name}-${backup.at || 'unknown'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const confirmDeleteBackup = () => {
    if (!deleteBackupKey) return
    const r = repo.deleteBackup(deleteBackupKey)
    setDeleteBackupKey(null)
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    toast.show('Đã xoá bản sao lưu')
    refreshData()
  }

  const confirmClearBackups = () => {
    const r = repo.clearBackups()
    setClearBackupsOpen(false)
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    toast.show('Đã xoá tất cả bản sao lưu')
    refreshData()
  }

  const restoreSeed = () => {
    const r = repo.restoreSeedQuiz()
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    toast.show('Đã thêm lại quiz mẫu')
    refreshData()
  }

  const savePasscode = () => {
    const r = repo.saveAdminPasscode(passcode.trim())
    if (!r.ok) {
      toast.show(r.error.message)
      return
    }
    setPasscodeMessage('Đã lưu passcode trên máy này.')
    toast.show('Đã lưu passcode')
  }

  const verifyPasscode = async () => {
    if (!passcode.trim()) {
      setPasscodeMessage('Nhập passcode trước.')
      return
    }
    const ok = await checkAdminPasscode(passcode.trim())
    setPasscodeMessage(ok ? 'Passcode đúng.' : 'Passcode không đúng.')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-3xl">Cài đặt</h1>
      <Card className="space-y-3">
        <TextField label="Tên fanpage" value={fanpageName} onChange={(e) => setFanpageName(e.target.value)} error={errors.fanpageName} />
        <TextField label="Mô tả quà" value={giftDescription} onChange={(e) => setGiftDescription(e.target.value)} error={errors.giftDescription} />
        <TextField label="Link fanpage (tuỳ chọn)" value={fanpageUrl} onChange={(e) => setFanpageUrl(e.target.value)} error={errors.fanpageUrl} />
        <div className="flex gap-3">
          <Button onClick={save}>Lưu</Button>
          <Button variant="secondary" onClick={reset}>Khôi phục mặc định</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl">Xếp hạng online</h2>
        <p className="text-sm text-ink/70">
          Passcode chỉ dùng cho thao tác online (xuất bản quiz, xoá dòng xếp hạng). Trang quản trị trên máy vẫn mở bình thường.
        </p>
        {online === false ? <p className="text-sm font-semibold text-alert">Máy chủ chưa bật xếp hạng online.</p> : null}
        <div>
          <label htmlFor="admin-passcode" className="block text-sm font-semibold">Passcode quản trị (cho tính năng online)</label>
          <input
            id="admin-passcode"
            type="password"
            className="w-full rounded-xl border-2 border-ink bg-white px-3 py-2 focus-visible:outline-4 focus-visible:outline-cobalt"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            autoComplete="current-password"
          />
        </div>
        {passcodeMessage ? <p className="text-sm font-medium">{passcodeMessage}</p> : null}
        <div className="flex gap-3">
          <Button onClick={savePasscode}>Lưu passcode</Button>
          <Button variant="secondary" onClick={() => void verifyPasscode()} disabled={online === false}>
            Kiểm tra
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-xl">Dữ liệu &amp; sao lưu</h2>
        <p className="text-sm">
          Dung lượng đang dùng: <strong>{formatBytes(usage.bytes)}</strong> / khoảng 5 MB
          <span className="text-ink/60"> ({usage.keys} khoá)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={restoreSeed}>Khôi phục quiz mẫu</Button>
          <Button variant="ghost" onClick={() => setClearBackupsOpen(true)} disabled={backups.length === 0}>
            Xoá tất cả bản sao lưu
          </Button>
        </div>

        {backups.length === 0 ? (
          <p className="text-sm text-ink/60">Chưa có bản sao lưu nào.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((backup) => (
              <div key={backup.key} className="border-2 border-ink/10 rounded-xl p-3 space-y-2">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">{backup.label}</p>
                    <p className="text-xs text-ink/60">{formatTime(backup.at)} · {formatBytes(backup.bytes)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => downloadBackup(backup)}>Tải về (.json)</Button>
                    <Button variant="ghost" onClick={() => setDeleteBackupKey(backup.key)}>Xoá</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ConfirmDialog
        open={!!deleteBackupKey}
        title="Xoá bản sao lưu?"
        message="Bản sao lưu này sẽ bị xoá vĩnh viễn."
        danger
        confirmLabel="Xoá"
        onConfirm={confirmDeleteBackup}
        onCancel={() => setDeleteBackupKey(null)}
      />
      <ConfirmDialog
        open={clearBackupsOpen}
        title="Xoá tất cả bản sao lưu?"
        message="Toàn bộ bản sao lưu dữ liệu hỏng sẽ bị xoá."
        danger
        confirmLabel="Xoá tất cả"
        onConfirm={confirmClearBackups}
        onCancel={() => setClearBackupsOpen(false)}
      />
    </div>
  )
}
