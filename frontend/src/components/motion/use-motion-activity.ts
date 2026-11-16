'use client'
import { useEffect, useState, type RefObject } from 'react'
import { useInView, useReducedMotion } from 'motion/react'

/** Keep decorative loops idle offscreen, in background tabs, or with reduced motion. */
export function useMotionActivity(ref: RefObject<Element | null>) {
  const visible = useInView(ref),
    reduced = useReducedMotion(),
    [tabVisible, setTabVisible] = useState(true)
  useEffect(() => {
    const changed = () => setTabVisible(!document.hidden)
    changed()
    document.addEventListener('visibilitychange', changed)
    return () => document.removeEventListener('visibilitychange', changed)
  }, [])
  return { active: visible && tabVisible && !reduced, reduced: !!reduced }
}
