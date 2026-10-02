import { createId } from './ids'
import { parseNameLabels } from './parseNames'
import type { DoubleSession, EventSession, NameEntry, Pair, Session, SpinResult, WheelSession } from './types'

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
    spins: [{ id: createId(), title: 'Grand Prize', repeatable: false, exciting: false }],
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

export function activeNames(session: WheelSession): NameEntry[] {
  const removed = new Set(session.removedIds)
  return session.names.filter((entry) => !removed.has(entry.id))
}

export type NameUpdate = {
  session: Session
  nameCount: number
  overLimit: boolean
}

export function setNameText(session: WheelSession, nameText: string): NameUpdate {
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

export function setDoubleText(session: DoubleSession, side: 'left' | 'right', text: string): NameUpdate {
  const parsed = parseNameLabels(text)
  if (side === 'left') {
    if (parsed.overLimit) {
      return { session: { ...session, leftText: text }, nameCount: parsed.labels.length, overLimit: true }
    }
    return {
      session: { ...session, leftText: text, leftNames: reconcileNames(session.leftNames, parsed.labels) },
      nameCount: parsed.labels.length,
      overLimit: false,
    }
  }
  if (parsed.overLimit) {
    return { session: { ...session, rightText: text }, nameCount: parsed.labels.length, overLimit: true }
  }
  return {
    session: { ...session, rightText: text, rightNames: reconcileNames(session.rightNames, parsed.labels) },
    nameCount: parsed.labels.length,
    overLimit: false,
  }
}

export function switchMode(session: Session, mode: Session['mode']): Session {
  if (session.mode === mode) return session
  const carried = session.mode === 'double'
    ? { nameText: session.leftText, names: session.leftNames }
    : { nameText: session.nameText, names: session.names }
  if (mode === 'direct') {
    return {
      mode: 'direct',
      nameText: carried.nameText,
      names: carried.names,
      repeatable: false,
      removedIds: [],
      results: [],
    }
  }
  if (mode === 'event') return createEventSession(carried.nameText, carried.names)
  return {
    mode: 'double',
    leftText: carried.nameText,
    leftNames: carried.names,
    rightText: '',
    rightNames: [],
    exciting: false,
    results: [],
  }
}

export function setDoubleExciting(session: DoubleSession, exciting: boolean): DoubleSession {
  return { ...session, exciting }
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
    spins: [...session.spins, { id: createId(), title: `Prize ${next}`, repeatable: false, exciting: false }],
  }
}

export function updateSpin(
  session: EventSession,
  id: string,
  patch: { title?: string; repeatable?: boolean; exciting?: boolean },
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
  if (session.mode === 'double') {
    const left = parseNameLabels(session.leftText)
    const right = parseNameLabels(session.rightText)
    if (left.overLimit || right.overLimit) return 'A list was not updated. Keep 80 names or fewer.'
    if (left.labels.length === 0 || right.labels.length === 0) return 'Add a name to both lists.'
    return null
  }
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

export function buildMatching(left: NameEntry[], right: NameEntry[]): Pair[] {
  if (left.length === 0 || right.length === 0) throw new Error('Both lists need a name')
  const leftIsLonger = left.length >= right.length
  const longer = shuffle(leftIsLonger ? left : right)
  const shorter = balancedCopies(leftIsLonger ? right : left, longer.length)
  return longer.map((entry, index) => {
    const partner = shorter[index]
    return leftIsLonger
      ? { left: entry.label, right: partner.label }
      : { left: partner.label, right: entry.label }
  })
}

export function commitMatching(session: DoubleSession, pairs: Pair[]): DoubleSession {
  return { ...session, results: [...session.results, pairs] }
}

export function pickWinner(names: NameEntry[]): NameEntry {
  if (names.length === 0) throw new Error('No names to pick')
  return names[fairIndex(names.length)]
}

export function commitResult(session: WheelSession, winner: NameEntry): WheelSession {
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
  if (session.mode === 'double') return { ...session, results: [] }
  return { ...session, removedIds: [], results: [], currentSpinIndex: 0 }
}

function balancedCopies(items: NameEntry[], count: number): NameEntry[] {
  const base = Math.floor(count / items.length)
  const extra = count % items.length
  const bonus = new Set(shuffle(items).slice(0, extra).map((item) => item.id))
  const bag: NameEntry[] = []
  for (const item of items) {
    const times = base + (bonus.has(item.id) ? 1 : 0)
    for (let copy = 0; copy < times; copy += 1) bag.push(item)
  }
  return shuffle(bag)
}

function shuffle<T>(items: T[]): T[] {
  const copy = items.slice()
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = fairIndex(index + 1)
    const current = copy[index]
    copy[index] = copy[swap]
    copy[swap] = current
  }
  return copy
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
