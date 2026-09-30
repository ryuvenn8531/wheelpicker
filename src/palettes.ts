export type WheelPalette = {
  id: string
  label: string
  colors: readonly string[]
}

// Add another object here to offer a new wheel color set.
export const WHEEL_PALETTES: readonly WheelPalette[] = [
  {
    id: 'peachy',
    label: 'Peachy',
    colors: ['#FAE8EB', '#F6CACA', '#E4C2C6', '#CD9FCC', '#0A014F'],
  },
  {
    id: 'vintage',
    label: 'Vintage',
    colors: ['#0C1618', '#004643', '#FAF4D3', '#D1AC00', '#F6BE9A'],
  },
  {
    id: 'bubblegum',
    label: 'Bubblegum',
    colors: ['#2E294E', '#EFBCD5', '#BE97C6', '#8661C1', '#4B5267'],
  },
  {
    id: 'disco',
    label: 'Disco',
    colors: ['#9AC4F8', '#99EDCC', '#CB958E', '#E36588', '#9A275A'],
  },
  {
    id: 'neutral',
    label: 'Neutral',
    colors: ['#EEF0F2', '#C6C7C4', '#A2999E', '#846A6A', '#353B3C'],
  },
]

export function paletteById(id: string): WheelPalette {
  return WHEEL_PALETTES.find((palette) => palette.id === id) ?? WHEEL_PALETTES[0]
}

export function sliceFill(palette: WheelPalette, index: number): string {
  const colors = palette.colors
  return colors[index % colors.length] ?? colors[0]
}

export function contrastText(hex: string): string {
  return luminance(hex) > 0.58 ? '#1a140f' : '#fffaf3'
}

function luminance(hex: string): number {
  const value = Number.parseInt(hex.slice(1), 16)
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255].map((channel) => {
    const scaled = channel / 255
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}
