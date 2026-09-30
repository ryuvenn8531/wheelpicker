export type NameEntry = {
  id: string
  label: string
}

export type NamedSpin = {
  id: string
  title: string
  repeatable: boolean
}

export type SpinResult = {
  id: string
  spinId?: string
  spinTitle?: string
  nameId: string
  name: string
  repeatable: boolean
  at: number
}

export type DirectSession = {
  mode: 'direct'
  nameText: string
  names: NameEntry[]
  repeatable: boolean
  removedIds: string[]
  results: SpinResult[]
}

export type EventSession = {
  mode: 'event'
  title: string
  nameText: string
  names: NameEntry[]
  spins: NamedSpin[]
  currentSpinIndex: number
  removedIds: string[]
  results: SpinResult[]
}

export type Session = DirectSession | EventSession
