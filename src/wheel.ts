import { contrastText, paletteById, sliceFill } from './palettes'
import type { NameEntry } from './types'

export type WheelSlice = {
  id: string
  label: string
}

type SpinAnimation = {
  from: number
  to: number
  started: number
  duration: number
  ease: (t: number) => number
  resolve: () => void
}

export class Wheel {
  private slices: WheelSlice[] = []
  private palette = paletteById('')
  private rotation = 0
  private frame = 0
  private pixelSize = 0
  private animation: SpinAnimation | null = null
  private onLiveName: (label: string | null) => void

  constructor(
    private canvas: HTMLCanvasElement,
    onLiveName: (label: string | null) => void,
  ) {
    this.onLiveName = onLiveName
  }

  setPalette(id: string): void {
    this.palette = paletteById(id)
    this.draw()
  }

  setSlices(slices: NameEntry[]): void {
    this.slices = slices.map((slice) => ({ id: slice.id, label: slice.label }))
    this.draw()
    this.onLiveName(this.sliceUnderPointer()?.label ?? null)
  }

  resize(): void {
    this.draw()
  }

  get spinning(): boolean {
    return this.animation !== null
  }

  spinTo(index: number, exciting = false): Promise<void> {
    if (this.animation || this.slices.length === 0) return Promise.resolve()
    const arc = (Math.PI * 2) / this.slices.length
    const desired = normalize(-(index + 0.5) * arc)
    const current = normalize(this.rotation)
    let delta = desired - current
    if (delta <= 0.0001) delta += Math.PI * 2
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const feel = spinFeel(reduce, exciting)
    const distance = delta + feel.turns * Math.PI * 2
    return new Promise((resolve) => {
      this.animation = {
        from: this.rotation,
        to: this.rotation + distance,
        started: performance.now(),
        duration: feel.duration,
        ease: feel.ease(distance, feel.duration),
        resolve,
      }
      this.tick(performance.now())
    })
  }

  private tick = (now: number): void => {
    const animation = this.animation
    if (!animation) return
    const t = Math.min(1, (now - animation.started) / animation.duration)
    this.rotation = animation.from + (animation.to - animation.from) * animation.ease(t)
    this.draw()
    this.onLiveName(this.sliceUnderPointer()?.label ?? null)
    if (t < 1) {
      this.frame = requestAnimationFrame(this.tick)
      return
    }
    this.rotation = animation.to
    this.animation = null
    this.draw()
    animation.resolve()
  }

  private sliceUnderPointer(): WheelSlice | null {
    const count = this.slices.length
    if (count === 0) return null
    const arc = (Math.PI * 2) / count
    const index = Math.floor(normalize(-this.rotation) / arc) % count
    return this.slices[index] ?? null
  }

  private draw(): void {
    const canvas = this.canvas
    const parent = canvas.parentElement
    const size = Math.max(240, Math.floor(parent?.clientWidth ?? 480))
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const pixelSize = Math.floor(size * dpr)
    if (this.pixelSize !== pixelSize) {
      this.pixelSize = pixelSize
      canvas.width = pixelSize
      canvas.height = pixelSize
    }
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    const center = size / 2
    const radius = center - 28
    ctx.save()
    ctx.translate(center, center)

    const count = this.slices.length
    if (count === 0) {
      ctx.beginPath()
      ctx.arc(0, 0, radius, 0, Math.PI * 2)
      ctx.fillStyle = '#3a3128'
      ctx.fill()
      ctx.fillStyle = '#d9cbb8'
      ctx.font = `600 18px ${uiFont()}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Add names', 0, 0)
      ctx.restore()
      return
    }

    const arc = (Math.PI * 2) / count
    ctx.rotate(this.rotation)
    for (let index = 0; index < count; index += 1) {
      const start = -Math.PI / 2 + index * arc
      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, start, start + arc)
      ctx.closePath()
      const fill = sliceFill(this.palette, index)
      ctx.fillStyle = fill
      ctx.fill()
      ctx.strokeStyle = 'rgba(26, 20, 15, 0.28)'
      ctx.lineWidth = count > 40 ? 1 : 2
      ctx.stroke()
      this.drawLabel(ctx, this.slices[index].label, start, arc, radius, contrastText(fill))
    }

    ctx.rotate(-this.rotation)
    ctx.beginPath()
    ctx.arc(0, 0, Math.max(28, radius * 0.14), 0, Math.PI * 2)
    ctx.fillStyle = '#1a140f'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#e4b15a'
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(0, -radius + 26)
    ctx.lineTo(16, -radius - 10)
    ctx.lineTo(-16, -radius - 10)
    ctx.closePath()
    ctx.fillStyle = '#f2c14e'
    ctx.fill()
    ctx.lineWidth = 2
    ctx.strokeStyle = '#1a140f'
    ctx.stroke()

    ctx.restore()
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    start: number,
    arc: number,
    radius: number,
    color: string,
  ): void {
    const outer = radius * 0.9
    let fontSize = Math.min(18, Math.max(9, (arc * radius) / 7))
    let maxWidth = Math.min(radius * 0.62, outer - fontSize / arc - 4)
    if (maxWidth < 18) {
      fontSize = 9
      maxWidth = Math.min(radius * 0.62, outer - fontSize / arc - 4)
    }
    if (maxWidth < 12) return
    ctx.save()
    ctx.rotate(start + arc / 2)
    ctx.fillStyle = color
    ctx.font = `600 ${fontSize}px ${uiFont()}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(fitText(ctx, label, maxWidth), outer, 0)
    ctx.restore()
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame)
  }
}

function uiFont(): string {
  const stack = getComputedStyle(document.documentElement).getPropertyValue('--font').trim()
  return stack || 'sans-serif'
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text
  let end = text.length
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) {
    end -= 1
  }
  return `${text.slice(0, end)}…`
}

function normalize(angle: number): number {
  const full = Math.PI * 2
  return ((angle % full) + full) % full
}

const EXCITING_CRAWL_SECONDS = 5
const EXCITING_CRAWL_RAD_PER_SEC = Math.PI / 180

export type SpinMotion = {
  duration: number
  turns: number
  ease: (t: number) => number
}

/** One independent roll of the wheel's spin timing, including an Exciting crawl. */
export function rollSpinMotion(exciting = false): SpinMotion {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const feel = spinFeel(reduce, exciting)
  const distance = Math.max(feel.turns, 1) * Math.PI * 2
  return {
    duration: feel.duration,
    turns: feel.turns,
    ease: feel.ease(distance, feel.duration),
  }
}

function spinFeel(
  reduce: boolean,
  exciting: boolean,
): { turns: number; duration: number; ease: (distance: number, duration: number) => (t: number) => number } {
  if (reduce) return { turns: exciting ? 1 : 0, duration: exciting ? 900 : 350, ease: () => easeOutCubic }
  if (exciting) {
    return {
      turns: 8 + Math.floor(Math.random() * 2),
      duration: 12000 + Math.random() * 1500,
      ease: easeExciting,
    }
  }
  const energy = Math.random()
  if (energy > 0.62) {
    return {
      turns: 7 + Math.floor(Math.random() * 3),
      duration: 2600 + Math.random() * 800,
      ease: () => easeOutQuart,
    }
  }
  if (energy < 0.38) {
    return {
      turns: 2 + Math.floor(Math.random() * 2),
      duration: 5600 + Math.random() * 2200,
      ease: () => easeOutSine,
    }
  }
  return {
    turns: 4 + Math.floor(Math.random() * 2),
    duration: 4000 + Math.random() * 1100,
    ease: () => easeOutCubic,
  }
}

/** Fast spin, then 5s already at 1°/s that keeps creeping and only settles at the end. */
function easeExciting(distance: number, durationMs: number): (t: number) => number {
  const duration = Math.max(durationMs / 1000, 0.001)
  const crawlSeconds = Math.min(EXCITING_CRAWL_SECONDS, duration * 0.55)
  // ∫(1-u^8) so speed stays near 1°/s and the stop is packed into the last moment.
  const crawlDistance = Math.min(
    EXCITING_CRAWL_RAD_PER_SEC * crawlSeconds * (8 / 9),
    distance * 0.5,
  )
  const uJoin = 1 - crawlSeconds / duration
  const pJoin = distance <= 0 ? 1 : 1 - crawlDistance / distance
  const slopeJoin = distance <= 0 ? 0 : (EXCITING_CRAWL_RAD_PER_SEC * duration) / distance
  const m1 = slopeJoin * uJoin
  const m0 = pJoin * 3

  return (t: number) => {
    if (t >= 1) return 1
    if (t <= 0) return 0
    if (t >= uJoin) {
      const u = (t - uJoin) / (1 - uJoin)
      const covered = (9 / 8) * (u - u ** 9 / 9)
      return pJoin + (1 - pJoin) * covered
    }
    const s = t / uJoin
    return hermiteApproach(s, pJoin, m0, m1)
  }
}

function hermiteApproach(s: number, p1: number, m0: number, m1: number): number {
  const s2 = s * s
  const s3 = s2 * s
  return m0 * (s3 - 2 * s2 + s) + p1 * (-2 * s3 + 3 * s2) + m1 * (s3 - s2)
}

function easeOutSine(t: number): number {
  return Math.sin((t * Math.PI) / 2)
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function easeOutQuart(t: number): number {
  return 1 - (1 - t) ** 4
}
