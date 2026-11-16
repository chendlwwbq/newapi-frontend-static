'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type { CatalogModel } from '@/lib/api/types'
import { useMotionActivity } from './use-motion-activity'

export function useModelTyping(models: CatalogModel[], ref: RefObject<Element | null>, paused = false) {
  const names = models.length ? models.map((model) => model.configured_model_id) : ['your-model']
  const [text, setText] = useState(''),
    [index, setIndex] = useState(0),
    [deleting, setDeleting] = useState(false)
  const { active, reduced } = useMotionActivity(ref)
  const target = names[index % names.length]
  useEffect(() => {
    if (!active || paused) return
    const complete = text === target
    let delay = 85
    if (deleting) delay = 40
    else if (complete) delay = 2200
    const timer = setTimeout(() => {
      if (deleting) {
        if (text) setText(text.slice(0, -1))
        else {
          setDeleting(false)
          setIndex((previous) => previous + 1)
        }
      } else if (complete) setDeleting(true)
      else setText(target.slice(0, text.length + 1))
    }, delay)
    return () => clearTimeout(timer)
  }, [text, target, deleting, active, paused])
  return { text: reduced ? target : text, target }
}

export function ModelTyping({ models, quoted = false }: { models: CatalogModel[]; quoted?: boolean }) {
  const ref = useRef<HTMLDivElement>(null),
    { text, target } = useModelTyping(models, ref)
  return (
    <div ref={ref} className="model-typing" aria-label={`model=${target}`}>
      <span>model{quoted ? ' = ' : '='}</span>
      <strong aria-hidden="true">
        {quoted ? '"' : ''}
        {text}
        {quoted ? '"' : ''}
      </strong>
      <i aria-hidden="true" />
    </div>
  )
}
