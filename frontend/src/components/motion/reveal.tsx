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
  const duration = compact ? 0.14 : 0.35
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : compact ? { opacity: 0 } : { opacity: 0, y: 18 }}
      whileInView={compact ? { opacity: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: reducedMotion ? 0 : duration, delay: reducedMotion ? 0 : compact ? 0 : delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
