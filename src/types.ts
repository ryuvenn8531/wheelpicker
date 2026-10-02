export type NameEntry = {
  id: string
  label: string
}

export type NamedSpin = {
  id: string
  title: string
  repeatable: boolean
  exciting: boolean
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

export type Pair = {
  left: string
  right: string
}

export type DoubleSession = {
  mode: 'double'
  leftText: string
  leftNames: NameEntry[]
  rightText: string
  rightNames: NameEntry[]
  exciting: boolean
  results: Pair[][]
}

export type WheelSession = DirectSession | EventSession

export type Session = WheelSession | DoubleSession
