import type { Pair } from './types'
import { rollSpinMotion, type SpinMotion } from './wheel'

type SideName = 'left' | 'right'

type Track = {
  labels: string[]
  motion: SpinMotion
  last: number
}

export function cycleSides(
  pairs: Pair[],
  exciting: boolean,
  onFrame: (side: SideName, label: string) => void,
): Promise<void> {
  if (pairs.length === 0) return Promise.resolve()
  const left = pairs.map((pair) => pair.left)
  const right = pairs.map((pair) => pair.right)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce) {
    onFrame('left', left[left.length - 1])
    onFrame('right', right[right.length - 1])
    return Promise.resolve()
  }

  const sides: Record<SideName, Track> = {
    left: { labels: left, motion: rollSpinMotion(exciting), last: -1 },
    right: { labels: right, motion: rollSpinMotion(exciting), last: -1 },
  }
  const duration = Math.max(sides.left.motion.duration, sides.right.motion.duration)
  return new Promise((resolve) => {
    const started = performance.now()
    const tick = (now: number) => {
      for (const side of ['left', 'right'] as const) stepSide(sides[side], side, now - started, onFrame)
      if (now - started < duration) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
}

function stepSide(
  track: Track,
  side: SideName,
  elapsed: number,
  onFrame: (side: SideName, label: string) => void,
): void {
  const turns = Math.max(track.motion.turns, 1)
  const steps = track.labels.length * turns
  const t = Math.min(1, elapsed / track.motion.duration)
  const index = Math.min(steps - 1, Math.floor(track.motion.ease(t) * steps))
  if (index === track.last) return
  track.last = index
  onFrame(side, track.labels[index % track.labels.length])
}
