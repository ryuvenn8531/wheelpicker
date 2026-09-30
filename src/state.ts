import { createId } from './ids'
import { parseNameLabels } from './parseNames'
import type { EventSession, NameEntry, Session, SpinResult } from './types'

export function createDirectSession(): Session {
  return {
    mode: 'direct',
    nameText: '',
    names: [],
    repeatable: false,
    removedIds: [],
    results: [],
  }
}

export function createEventSession(nameText = '', names: NameEntry[] = []): EventSession {
  return {
    mode: 'event',
    title: '',
    nameText,
    names,
    spins: [{ id: createId(), title: 'Grand Prize', repeatable: false }],
    currentSpinIndex: 0,
    removedIds: [],
    results: [],
  }
}

export function reconcileNames(previous: NameEntry[], labels: string[]): NameEntry[] {
  const pool = previous.map((entry) => ({ ...entry, used: false }))
  return labels.map((label) => {
    const match = pool.find((entry) => !entry.used && entry.label === label)
    if (match) {
      match.used = true
      return { id: match.id, label }
    }
    return { id: createId(), label }
  })
}

export function activeNames(session: Session): NameEntry[] {
  const removed = new Set(session.removedIds)
  return session.names.filter((entry) => !removed.has(entry.id))
}

export type NameUpdate = {
  session: Session
  nameCount: number
  overLimit: boolean
}

export function setNameText(session: Session, nameText: string): NameUpdate {
  const parsed = parseNameLabels(nameText)
  if (parsed.overLimit) {
    return { session: { ...session, nameText }, nameCount: parsed.labels.length, overLimit: true }
  }
  const names = reconcileNames(session.names, parsed.labels)
  const live = new Set(names.map((entry) => entry.id))
  const removedIds = session.removedIds.filter((id) => live.has(id))
  return {
    session: { ...session, nameText, names, removedIds },
    nameCount: parsed.labels.length,
    overLimit: false,
  }
}

export function switchMode(session: Session, mode: Session['mode']): Session {
  if (session.mode === mode) return session
  if (mode === 'direct') {
    return {
      mode: 'direct',
      nameText: session.nameText,
      names: session.names,
      repeatable: false,
      removedIds: [],
      results: [],
    }
  }
  return createEventSession(session.nameText, session.names)
}

export function setDirectRepeatable(session: Session, repeatable: boolean): Session {
  if (session.mode !== 'direct') return session
  return { ...session, repeatable }
}

export function setEventTitle(session: Session, title: string): Session {
  if (session.mode !== 'event') return session
  return { ...session, title }
}

export function addSpin(session: EventSession): EventSession {
  const next = session.spins.length + 1
  return {
    ...session,
    spins: [...session.spins, { id: createId(), title: `Prize ${next}`, repeatable: false }],
  }
}

export function updateSpin(
  session: EventSession,
  id: string,
  patch: { title?: string; repeatable?: boolean },
): EventSession {
  return {
    ...session,
    spins: session.spins.map((spin) => (spin.id === id ? { ...spin, ...patch } : spin)),
  }
}

export function removeSpin(session: EventSession, id: string): EventSession {
  const index = session.spins.findIndex((spin) => spin.id === id)
  if (index < 0 || index < session.currentSpinIndex) return session
  const spins = session.spins.filter((spin) => spin.id !== id)
  return { ...session, spins }
}

export function moveSpin(session: EventSession, id: string, direction: -1 | 1): EventSession {
  const index = session.spins.findIndex((spin) => spin.id === id)
  const target = index + direction
  if (
    index < session.currentSpinIndex ||
    target < session.currentSpinIndex ||
    target >= session.spins.length
  ) {
    return session
  }
  const spins = session.spins.slice()
  const [item] = spins.splice(index, 1)
  spins.splice(target, 0, item)
  return { ...session, spins }
}

export function spinBlockReason(session: Session): string | null {
  if (parseNameLabels(session.nameText).overLimit) {
    return 'The wheel was not updated. Keep 80 names or fewer.'
  }
  if (session.mode === 'event') {
    if (session.spins.length === 0) return 'Add a named spin to this event.'
    if (session.currentSpinIndex >= session.spins.length) {
      return 'Every spin in this event is done. Reset to run it again.'
    }
  }
  if (activeNames(session).length === 0) return 'No names left on the wheel.'
  return null
}

export function currentSpin(session: Session) {
  if (session.mode !== 'event') return null
  return session.spins[session.currentSpinIndex] ?? null
}

export function pickWinner(names: NameEntry[]): NameEntry {
  if (names.length === 0) throw new Error('No names to pick')
  return names[fairIndex(names.length)]
}

export function commitResult(session: Session, winner: NameEntry): Session {
  if (session.mode === 'direct') {
    const result: SpinResult = {
      id: createId(),
      nameId: winner.id,
      name: winner.label,
      repeatable: session.repeatable,
      at: Date.now(),
    }
    return {
      ...session,
      removedIds: session.repeatable ? session.removedIds : [...session.removedIds, winner.id],
      results: [...session.results, result],
    }
  }

  const spin = session.spins[session.currentSpinIndex]
  if (!spin) return session
  const title = spin.title.trim() || `Spin ${session.currentSpinIndex + 1}`
  const result: SpinResult = {
    id: createId(),
    spinId: spin.id,
    spinTitle: title,
    nameId: winner.id,
    name: winner.label,
    repeatable: spin.repeatable,
    at: Date.now(),
  }
  return {
    ...session,
    removedIds: spin.repeatable ? session.removedIds : [...session.removedIds, winner.id],
    results: [...session.results, result],
    currentSpinIndex: session.currentSpinIndex + 1,
  }
}

export function resetDraws(session: Session): Session {
  if (session.mode === 'direct') {
    return { ...session, removedIds: [], results: [] }
  }
  return { ...session, removedIds: [], results: [], currentSpinIndex: 0 }
}

function fairIndex(length: number): number {
  const max = 0x1_0000_0000
  const limit = max - (max % length)
  const buffer = new Uint32Array(1)
  let value = 0
  do {
    crypto.getRandomValues(buffer)
    value = buffer[0]
  } while (value >= limit)
  return value % length
}
