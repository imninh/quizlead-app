import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'

function Wipe() {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timeout = window.setTimeout(() => setVisible(false), 700)
    return () => window.clearTimeout(timeout)
  }, [])

  if (!visible) return null
  return (
    <motion.div
      aria-hidden="true"
      data-scene-wipe=""
      initial={{ x: '-110%' }}
      animate={{ x: '160%' }}
      onAnimationComplete={() => setVisible(false)}
      transition={{ duration: 0.7, ease: 'easeInOut' }}
      className="pointer-events-none fixed inset-y-0 left-0 z-20 w-2/3 bg-sun/60 blur-sm"
    />
  )
}

export function SceneWipe({ sceneKey }: { sceneKey: number }) {
  const reduced = useReducedMotion()
  if (reduced) return null
  return <Wipe key={sceneKey} />
}
