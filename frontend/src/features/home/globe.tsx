'use client'
import { useEffect, useRef } from 'react'
import { useMotionActivity } from '@/components/motion/use-motion-activity'

// Hand-authored low resolution continent masks, projected onto a rotating sphere.
const continents = [
  [
    [-168, 72],
    [-125, 72],
    [-58, 48],
    [-82, 10],
    [-115, 27],
    [-140, 57],
  ],
  [
    [-82, 12],
    [-46, -4],
    [-35, -23],
    [-69, -57],
    [-78, -18],
  ],
  [
    [-14, 36],
    [4, 70],
    [50, 71],
    [48, 37],
    [30, 29],
  ],
  [
    [-18, 34],
    [36, 32],
    [50, 11],
    [30, -35],
    [12, -34],
    [-16, 10],
  ],
  [
    [35, 68],
    [180, 68],
    [145, 35],
    [124, 22],
    [103, -8],
    [73, 8],
    [48, 35],
  ],
  [
    [112, -12],
    [154, -10],
    [153, -39],
    [115, -35],
  ],
  [
    [-51, 83],
    [-20, 71],
    [-44, 58],
    [-62, 69],
  ],
]
function inPolygon(lon: number, lat: number, polygon: number[][]) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i],
      [xj, yj] = polygon[j]
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}
type GlobePoint = [number, number, number, boolean]

function createGlobePoints(): GlobePoint[] {
  const points: GlobePoint[] = []
  for (let lat = -80; lat <= 80; lat += 2.4)
    for (let lon = -180; lon < 180; lon += 2.4) {
      const phi = (lat * Math.PI) / 180,
        theta = (lon * Math.PI) / 180
      points.push([
        Math.cos(phi) * Math.sin(theta),
        -Math.sin(phi),
        Math.cos(phi) * Math.cos(theta),
        continents.some((polygon) => inPolygon(lon, lat, polygon)),
      ])
    }
  return points
}

export function Globe() {
  const ref = useRef<HTMLCanvasElement>(null)
  const { active, reduced } = useMotionActivity(ref)
  const activityRef = useRef({ active, reduced })
  const angleRef = useRef(0.3)
  const scheduleRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const canvas = ref.current,
      context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const ctx = context
    const points = createGlobePoints()
    let width = 0,
      height = 0,
      frame = 0,
      dark = false,
      lastTime = 0,
      lastPaint = 0

    function paintFrame() {
      if (!width || !height) return
      ctx.clearRect(0, 0, width, height)
      const radius = Math.max(width * 0.54, height * 0.72),
        cos = Math.cos(angleRef.current),
        sin = Math.sin(angleRef.current)
      ctx.font = '8px monospace'
      for (const [x, y, z, land] of points) {
        const rx = x * cos + z * sin,
          rz = z * cos - x * sin
        if (rz < -0.2) continue
        const alpha = (land ? 0.38 : 0.065) * Math.max(0.1, rz)
        ctx.fillStyle = dark ? `rgba(190,190,207,${alpha})` : `rgba(80,80,100,${alpha})`
        ctx.fillText(land ? '·' : '.', width / 2 + rx * radius, height * 0.52 + y * radius)
      }
    }

    function draw(time: number) {
      frame = 0
      const state = activityRef.current
      if (!width || (!state.active && !state.reduced)) return
      if (time - lastPaint >= 32 || state.reduced) {
        if (lastTime && state.active) angleRef.current += Math.min(time - lastTime, 64) * 0.000025
        lastTime = time
        lastPaint = time
        paintFrame()
      }
      if (state.active) frame = requestAnimationFrame(draw)
    }

    function refresh() {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
      lastPaint = 0
      const state = activityRef.current
      if (state.active) frame = requestAnimationFrame(draw)
      else if (state.reduced) paintFrame()
    }

    scheduleRef.current = refresh

    const size = new ResizeObserver(([entry]) => {
      width = entry.contentRect.width
      height = entry.contentRect.height
      const dpr = Math.min(devicePixelRatio, 2)
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      refresh()
    })
    size.observe(canvas)

    const theme = () => {
      dark = document.documentElement.dataset.theme === 'dark'
      refresh()
    }
    theme()
    const themes = new MutationObserver(theme)
    themes.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => {
      scheduleRef.current = null
      cancelAnimationFrame(frame)
      size.disconnect()
      themes.disconnect()
    }
  }, [])

  useEffect(() => {
    activityRef.current = { active, reduced }
    scheduleRef.current?.()
  }, [active, reduced])

  return <canvas className="hero-globe" ref={ref} aria-hidden="true" />
}
