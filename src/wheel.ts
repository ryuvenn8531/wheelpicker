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

  spinTo(index: number): Promise<void> {
    if (this.animation || this.slices.length === 0) return Promise.resolve()
    const arc = (Math.PI * 2) / this.slices.length
    const desired = normalize(-(index + 0.5) * arc)
    const current = normalize(this.rotation)
    let delta = desired - current
    if (delta <= 0.0001) delta += Math.PI * 2
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const turns = reduce ? 0 : 5
    const duration = reduce ? 350 : 4800
    return new Promise((resolve) => {
      this.animation = {
        from: this.rotation,
        to: this.rotation + delta + turns * Math.PI * 2,
        started: performance.now(),
        duration,
        resolve,
      }
      this.tick(performance.now())
    })
  }

  private tick = (now: number): void => {
    const animation = this.animation
    if (!animation) return
    const t = Math.min(1, (now - animation.started) / animation.duration)
    this.rotation = animation.from + (animation.to - animation.from) * easeOutCubic(t)
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

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}
