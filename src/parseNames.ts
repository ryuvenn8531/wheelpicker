export const MAX_NAMES = 80

export type ParsedNames = {
  labels: string[]
  overLimit: boolean
}

export function parseNameLabels(text: string): ParsedNames {
  const labels = text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)

  return {
    labels,
    overLimit: labels.length > MAX_NAMES,
  }
}
