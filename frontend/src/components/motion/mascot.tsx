'use client'
import { useTranslation } from 'react-i18next'
import { useRef, useState } from 'react'
import { motion } from 'motion/react'
import { useMotionActivity } from './use-motion-activity'

export function Mascot({ small = false }: { small?: boolean }) {
  const { t } = useTranslation()
  const [happy, setHappy] = useState(false)
  const ref = useRef<HTMLButtonElement>(null),
    { active } = useMotionActivity(ref)
  return (
    <motion.button
      ref={ref}
      type="button"
      className={`mascot ${small ? 'mascot-small' : ''}`}
      aria-label={t('Say hello to eva')}
      onClick={() => setHappy((v) => !v)}
      animate={!active ? { y: 0, rotate: 0 } : { y: happy ? [0, -15, 0] : [0, -6, 0], rotate: happy ? [0, -8, 8, 0] : 0 }}
      transition={active ? { duration: happy ? 0.7 : 4, repeat: happy ? 0 : Infinity, ease: 'easeInOut' } : { duration: 0 }}
    >
      <MascotMark happy={happy} />
    </motion.button>
  )
}

export function MascotMark({ happy = false }: { happy?: boolean }) {
  return (
    <svg viewBox="0 0 128 100" aria-hidden="true">
      <g fill="#8787ff">
        <rect x="16" y="62" width="14" height="30" rx="7" transform="rotate(18 23 70)" />
        <rect x="43" y="65" width="14" height="34" rx="7" />
        <rect x="70" y="65" width="14" height="34" rx="7" transform="rotate(-8 77 72)" />
        <rect x="96" y="62" width="14" height="30" rx="7" transform="rotate(-18 103 70)" />
      </g>
      <path fill="currentColor" d="M4 46C4 18 26 4 45 4h38c24 0 41 19 41 43v12c0 7-5 12-12 12H16C9 71 4 66 4 59z" />
      <g fill="var(--background)">
        {happy ? (
          <>
            <path d="m36 40 7-7 7 7" fill="none" stroke="var(--background)" strokeWidth="5" strokeLinecap="round" />
            <path d="m78 40 7-7 7 7" fill="none" stroke="var(--background)" strokeWidth="5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <rect x="37" y="25" width="14" height="23" rx="7" />
            <rect x="77" y="25" width="14" height="23" rx="7" />
          </>
        )}
      </g>
    </svg>
  )
}
