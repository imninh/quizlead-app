import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Doodle, type DoodleKind } from './Doodle'

export function FloatingDoodle({
  kind,
  size = 48,
  color,
  className = '',
  delay = 0,
}: {
  kind: DoodleKind
  size?: number
  color?: string
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const onVisibility = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (reduced) return <Doodle kind={kind} size={size} color={color} className={className} />

  return (
    <motion.div
      className={className}
      animate={visible ? { y: [0, -7, 0], rotate: [-2, 2, -2] } : {}}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      <Doodle kind={kind} size={size} color={color} />
    </motion.div>
  )
}
