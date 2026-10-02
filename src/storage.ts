import { createDirectSession } from './state'
import type { DoubleSession, EventSession, NameEntry, NamedSpin, Pair, Session, SpinResult } from './types'

const STORAGE_KEY = 'wheelpicker.session.v1'

export function loadSession(): Session {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return createDirectSession()
    const parsed = JSON.parse(raw) as unknown
    const session = normalizeSession(parsed)
    return session ?? createDirectSession()
  } catch {
    return createDirectSession()
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

function normalizeSession(value: unknown): Session | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const nameText = typeof record.nameText === 'string' ? record.nameText : ''
  const names = normalizeNames(record.names)
  const removedIds = stringArray(record.removedIds).filter((id) => names.some((entry) => entry.id === id))
  const results = normalizeResults(record.results)

  if (record.mode === 'direct') {
    return {
      mode: 'direct',
      nameText,
      names,
      repeatable: record.repeatable === true,
      removedIds,
      results,
    }
  }

  if (record.mode === 'double') {
    return {
      mode: 'double',
      leftText: typeof record.leftText === 'string' ? record.leftText : '',
      leftNames: normalizeNames(record.leftNames),
      rightText: typeof record.rightText === 'string' ? record.rightText : '',
      rightNames: normalizeNames(record.rightNames),
      exciting: record.exciting === true,
      results: normalizePairings(record.results),
    }
  }

  if (record.mode === 'event') {
    const spins = normalizeSpins(record.spins)
    const current = typeof record.currentSpinIndex === 'number' ? Math.floor(record.currentSpinIndex) : 0
    return {
      mode: 'event',
      title: typeof record.title === 'string' ? record.title : '',
      nameText,
      names,
      spins,
      currentSpinIndex: Math.min(Math.max(0, current), spins.length),
      removedIds,
      results,
    }
  }

  return null
}

function normalizeNames(value: unknown): NameEntry[] {
  if (!Array.isArray(value)) return []
  const names: NameEntry[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.label !== 'string') continue
    const label = record.label.trim()
    if (!label) continue
    names.push({ id: record.id, label })
  }
  return names.slice(0, 80)
}

function normalizeSpins(value: unknown): NamedSpin[] {
  if (!Array.isArray(value)) return []
  const spins: NamedSpin[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.title !== 'string') continue
    spins.push({
      id: record.id,
      title: record.title,
      repeatable: record.repeatable === true,
      exciting: record.exciting === true,
    })
  }
  return spins
}

function normalizeResults(value: unknown): SpinResult[] {
  if (!Array.isArray(value)) return []
  const results: SpinResult[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    if (typeof record.id !== 'string' || typeof record.nameId !== 'string' || typeof record.name !== 'string') {
      continue
    }
    const result: SpinResult = {
      id: record.id,
      nameId: record.nameId,
      name: record.name,
      repeatable: record.repeatable === true,
      at: typeof record.at === 'number' ? record.at : Date.now(),
    }
    if (typeof record.spinId === 'string') result.spinId = record.spinId
    if (typeof record.spinTitle === 'string') result.spinTitle = record.spinTitle
    results.push(result)
  }
  return results
}

function normalizePairings(value: unknown): Pair[][] {
  if (!Array.isArray(value)) return []
  const runs: Pair[][] = []
  for (const run of value) {
    if (!Array.isArray(run)) continue
    const pairs: Pair[] = []
    for (const item of run) {
      if (!item || typeof item !== 'object') continue
      const record = item as Record<string, unknown>
      if (typeof record.left !== 'string' || typeof record.right !== 'string') continue
      const left = record.left.trim()
      const right = record.right.trim()
      if (!left || !right) continue
      pairs.push({ left, right })
    }
    if (pairs.length > 0) runs.push(pairs)
  }
  return runs
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === 'string')
}

export function isEventSession(session: Session): session is EventSession {
  return session.mode === 'event'
}

export function isDoubleSession(session: Session): session is DoubleSession {
  return session.mode === 'double'
}
