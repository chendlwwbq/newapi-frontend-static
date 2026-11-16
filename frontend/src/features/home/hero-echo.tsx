'use client'
import { useRef } from 'react'
import { useMotionActivity } from '@/components/motion/use-motion-activity'

/** Decorative model-name texture inspired by the supplied homepage. */
export function HeroEcho({ model }: { model: string }) {
  const ref = useRef<HTMLDivElement>(null),
    { active } = useMotionActivity(ref)
  const label = model.slice(0, 64).toUpperCase()
  return (
    <div ref={ref} className="hero-echo" aria-hidden="true" data-visible={!!label} data-active={active && !!label}>
      <div className="hero-echo-ribbon">
        {Array.from({ length: 14 }, (_, index) => (
          <div key={index}>
            {Array.from({ length: 8 }, (_, repeat) => (
              <span key={repeat}>{label}　</span>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
