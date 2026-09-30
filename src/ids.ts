let counter = 0

export function createId(): string {
  counter += 1
  const time = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 8)
  return `${time}-${counter.toString(36)}-${rand}`
}
