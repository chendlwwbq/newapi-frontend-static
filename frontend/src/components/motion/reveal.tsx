'use client'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

export function Reveal({
  children,
  className,
  delay = 0,
  compact = false,
}: {
  children: ReactNode
  className?: string
  delay?: number
  compact?: boolean
}) {
  const reducedMotion = useReducedMotion()
  const yOffset = compact ? 6 : 18
  const duration = compact ? 0.16 : 0.45
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y: yOffset }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : compact ? 0 : delay, ease: [0.2, 0.7, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
