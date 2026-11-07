import { useEffect, useState } from 'react'
import { getOnlineHealth } from '../services/onlineClient'

/** null = đang kiểm tra, true/false = kết quả /api/health trong phiên. */
export function useOnlineService(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    let active = true
    getOnlineHealth().then((value) => {
      if (active) setOnline(value)
    })
    return () => {
      active = false
    }
  }, [])

  return online
}
