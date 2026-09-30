import { paletteById } from './palettes'

export type FontChoice = {
  id: string
  label: string
  stack: string
}

export const FONTS: FontChoice[] = [
  { id: 'sans', label: 'Sans', stack: '"Avenir Next", "Segoe UI", sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Palatino, "Iowan Old Style", Georgia, serif' },
  { id: 'mono', label: 'Mono', stack: '"SF Mono", ui-monospace, Menlo, Consolas, monospace' },
  { id: 'rounded', label: 'Rounded', stack: '"Avenir Next Rounded", ui-rounded, "Avenir Next", sans-serif' },
  { id: 'humanist', label: 'Humanist', stack: '"Gill Sans", "Trebuchet MS", sans-serif' },
]

export type Appearance = {
  fontId: string
  background: string
  paletteId: string
}

const STORAGE_KEY = 'wheelpicker.appearance.v1'
const DEFAULT_BACKGROUND = '#14110e'

export function defaultAppearance(): Appearance {
  return { fontId: 'sans', background: DEFAULT_BACKGROUND, paletteId: paletteById('').id }
}

export function loadAppearance(): Appearance {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultAppearance()
    const parsed = JSON.parse(raw) as Partial<Appearance>
    return normalizeAppearance(parsed)
  } catch {
    return defaultAppearance()
  }
}

export function saveAppearance(appearance: Appearance): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
}

export function applyAppearance(appearance: Appearance): void {
  const font = FONTS.find((item) => item.id === appearance.fontId) ?? FONTS[0]
  const background = appearance.background
  const light = luminance(background) > 0.42
  const root = document.documentElement
  root.style.setProperty('--font', font.stack)
  root.style.setProperty('--bg', background)
  root.style.setProperty('--bg-glow', mix(background, light ? '#000000' : '#ffffff', light ? 0.08 : 0.16))
  root.style.setProperty('--bg-raise', mix(background, light ? '#000000' : '#ffffff', light ? 0.05 : 0.07))
  root.style.setProperty('--surface', mix(background, light ? '#ffffff' : '#000000', light ? 0.28 : 0.22))
  root.style.setProperty('--line', mix(background, light ? '#000000' : '#ffffff', light ? 0.16 : 0.2))
  root.style.setProperty('--text', light ? '#1c1612' : '#f6f0e6')
  root.style.setProperty('--muted', light ? '#5e5348' : '#c3b5a4')
  root.style.colorScheme = light ? 'light' : 'dark'
}

function normalizeAppearance(value: Partial<Appearance>): Appearance {
  const fontId = FONTS.some((item) => item.id === value.fontId) ? value.fontId! : 'sans'
  const background = typeof value.background === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.background)
    ? value.background.toLowerCase()
    : DEFAULT_BACKGROUND
  return { fontId, background, paletteId: paletteById(typeof value.paletteId === 'string' ? value.paletteId : '').id }
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function mix(from: string, toward: string, amount: number): string {
  const start = hexToRgb(from)
  const end = hexToRgb(toward)
  return rgbToHex(start.map((channel, index) => channel + (end[index] - channel) * amount) as [number, number, number])
}

function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b]
    .map((channel) => Math.round(Math.min(255, Math.max(0, channel))).toString(16).padStart(2, '0'))
    .join('')}`
}
