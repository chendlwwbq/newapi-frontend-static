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
  const duration = compact ? 0.28 : 0.42
  const resolvedDelay = reducedMotion ? 0 : compact ? Math.min(delay, 0.24) : delay
  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : compact ? { opacity: 0, y: 10, scale: 0.985 } : { opacity: 0, y: 20 }}
      whileInView={compact ? { opacity: 1, y: 0, scale: 1 } : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.08 }}
      transition={{ duration: reducedMotion ? 0 : duration, delay: resolvedDelay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}
