import './styles.css'
import { applyAppearance, FONTS, loadAppearance, saveAppearance, type Appearance } from './appearance'
import { WHEEL_PALETTES } from './palettes'
import { MAX_NAMES, parseNameLabels } from './parseNames'
import { cycleSides } from './doubleSpin'
import { isDoubleSession, isEventSession, loadSession, saveSession } from './storage'
import {
  activeNames,
  addSpin,
  buildMatching,
  commitMatching,
  commitResult,
  currentSpin,
  moveSpin,
  pickWinner,
  removeSpin,
  resetDraws,
  setDirectRepeatable,
  setDoubleExciting,
  setDoubleText,
  setEventTitle,
  setNameText,
  spinBlockReason,
  switchMode,
  updateSpin,
} from './state'
import type { NameEntry, Pair, Session } from './types'
import { Wheel } from './wheel'

const app = document.querySelector('#app')
if (!app) throw new Error('Missing #app')

app.innerHTML = `
  <header class="top">
    <div class="top-copy">
      <h1>Name wheel</h1>
      <p class="lede">Spin a name, or run a lucky draw one named prize at a time.</p>
    </div>
    <div class="top-actions">
      <div class="modes" role="group" aria-label="Wheel mode">
        <button type="button" id="mode-direct" aria-pressed="true">Direct Spin</button>
        <button type="button" id="mode-event" aria-pressed="false">Event</button>
        <button type="button" id="mode-double" aria-pressed="false">Double</button>
      </div>
      <div class="settings">
        <button type="button" id="settings-toggle" class="gear" aria-label="Settings" aria-expanded="false" aria-controls="settings-panel">
          <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.4l1.6 1.6M17.5 16l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.6l1.6-1.6M17.5 8l1.6-1.6"></path>
          </svg>
        </button>
        <div id="settings-panel" class="settings-panel" hidden>
          <label>
            Font
            <select id="font-select"></select>
          </label>
          <div class="palette-field">
            <p class="section-title">Wheel colors</p>
            <div id="palette-list" class="palette-list" role="listbox" aria-label="Wheel colors"></div>
          </div>
          <label>
            Background color
            <input id="background-color" type="color" value="#14110e" />
          </label>
        </div>
      </div>
    </div>
  </header>
  <main class="layout">
    <section class="stage">
      <div class="wheel-frame"><canvas id="wheel" aria-label="Name wheel"></canvas></div>
      <div id="pair-stage" class="pair-stage" hidden>
        <div class="pair-boxes">
          <div id="pair-left" class="pair-box">Ready</div>
          <div id="pair-right" class="pair-box">Ready</div>
        </div>
        <ol id="pair-list" class="pair-list" aria-live="polite" hidden></ol>
      </div>
      <div class="result">
        <p id="spin-hint" class="spin-hint" hidden>Tap the wheel or press the space bar for the next spin</p>
        <div id="result-row" class="result-row">
          <button type="button" id="live-name" class="live-name">Ready</button>
        </div>
        <p id="live-meta" class="live-meta"></p>
      </div>
    </section>
    <section class="panel">
      <label id="event-title-field">
        Event name
        <input id="event-title" type="text" placeholder="Company lucky draw" />
      </label>
      <p id="progress" class="hint"></p>
      <label id="names-field">
        Names, separated by commas
        <textarea id="names" placeholder="Ada, Grace, Linus"></textarea>
      </label>
      <p id="count" class="count">0/${MAX_NAMES}</p>
      <p id="names-hint" class="hint">Paste a list in one go. Empty entries are ignored. The wheel holds ${MAX_NAMES} names.</p>
      <div id="double-fields" hidden>
        <label>
          Left, separated by commas
          <textarea id="left-names" placeholder="Ada, Grace, Linus"></textarea>
        </label>
        <p id="left-count" class="count">0/${MAX_NAMES}</p>
        <label>
          Right, separated by commas
          <textarea id="right-names" placeholder="Red, Blue, Gold"></textarea>
        </label>
        <p id="right-count" class="count">0/${MAX_NAMES}</p>
        <p class="hint">Each spin pairs every name on the longer list. The shorter list is reused so its names are spread evenly, in a random order.</p>
        <label class="check">
          <input id="double-exciting" type="checkbox" />
          Exciting!
        </label>
      </div>
      <label class="check" id="direct-repeat-field">
        <input id="direct-repeat" type="checkbox" />
        Repeatable — winners stay on the wheel
      </label>
      <div id="event-spins">
        <p class="section-title">Spins, in order</p>
        <p class="spin-note">Each spin can keep or remove its winner. Finished spins stay locked.</p>
        <ol id="spin-list" class="spins"></ol>
        <button type="button" id="add-spin" class="add-spin">Add spin</button>
      </div>
      <div class="actions">
        <button type="button" id="spin" class="spin-button">SPIN</button>
        <button type="button" id="reset" class="reset-button">Reset draws</button>
      </div>
      <p id="status" class="status"></p>
      <div>
        <p class="section-title">Results</p>
        <ol id="history" class="history"></ol>
      </div>
      <div id="roster-field">
        <p class="section-title">On the wheel</p>
        <ul id="roster" class="roster"></ul>
      </div>
    </section>
  </main>
`

const canvas = document.querySelector<HTMLCanvasElement>('#wheel')!
const pairStage = document.querySelector<HTMLElement>('#pair-stage')!
const pairLeft = document.querySelector<HTMLElement>('#pair-left')!
const pairRight = document.querySelector<HTMLElement>('#pair-right')!
const pairList = document.querySelector<HTMLElement>('#pair-list')!
const liveName = document.querySelector<HTMLButtonElement>('#live-name')!
const spinHint = document.querySelector<HTMLElement>('#spin-hint')!
const resultRow = document.querySelector<HTMLElement>('#result-row')!
const liveMeta = document.querySelector<HTMLElement>('#live-meta')!
const modeDirect = document.querySelector<HTMLButtonElement>('#mode-direct')!
const modeEvent = document.querySelector<HTMLButtonElement>('#mode-event')!
const modeDouble = document.querySelector<HTMLButtonElement>('#mode-double')!
const eventTitleField = document.querySelector<HTMLElement>('#event-title-field')!
const eventTitle = document.querySelector<HTMLInputElement>('#event-title')!
const progress = document.querySelector<HTMLElement>('#progress')!
const namesLabel = document.querySelector<HTMLElement>('#names-field')!
const namesField = document.querySelector<HTMLTextAreaElement>('#names')!
const namesHint = document.querySelector<HTMLElement>('#names-hint')!
const count = document.querySelector<HTMLElement>('#count')!
const doubleFields = document.querySelector<HTMLElement>('#double-fields')!
const leftField = document.querySelector<HTMLTextAreaElement>('#left-names')!
const rightField = document.querySelector<HTMLTextAreaElement>('#right-names')!
const leftCount = document.querySelector<HTMLElement>('#left-count')!
const rightCount = document.querySelector<HTMLElement>('#right-count')!
const doubleExciting = document.querySelector<HTMLInputElement>('#double-exciting')!
const directRepeatField = document.querySelector<HTMLElement>('#direct-repeat-field')!
const directRepeat = document.querySelector<HTMLInputElement>('#direct-repeat')!
const eventSpins = document.querySelector<HTMLElement>('#event-spins')!
const spinList = document.querySelector<HTMLElement>('#spin-list')!
const addSpinButton = document.querySelector<HTMLButtonElement>('#add-spin')!
const spinButton = document.querySelector<HTMLButtonElement>('#spin')!
const resetButton = document.querySelector<HTMLButtonElement>('#reset')!
const status = document.querySelector<HTMLElement>('#status')!
const history = document.querySelector<HTMLElement>('#history')!
const rosterField = document.querySelector<HTMLElement>('#roster-field')!
const roster = document.querySelector<HTMLElement>('#roster')!
const settingsToggle = document.querySelector<HTMLButtonElement>('#settings-toggle')!
const settingsPanel = document.querySelector<HTMLElement>('#settings-panel')!
const fontSelect = document.querySelector<HTMLSelectElement>('#font-select')!
const paletteList = document.querySelector<HTMLElement>('#palette-list')!
const backgroundColor = document.querySelector<HTMLInputElement>('#background-color')!

let appearance: Appearance = loadAppearance()
applyAppearance(appearance)
fontSelect.replaceChildren(
  ...FONTS.map((font) => {
    const option = document.createElement('option')
    option.value = font.id
    option.textContent = font.label
    return option
  }),
)
fontSelect.value = appearance.fontId
renderPaletteOptions()
backgroundColor.value = appearance.background

let session: Session = loadSession()
let spinning = false
let showingResult = session.results.length > 0
let landedWheel: NameEntry[] | null = null

const wheel = new Wheel(canvas, () => {})
wheel.setPalette(appearance.paletteId)

settingsToggle.addEventListener('click', () => {
  const open = settingsPanel.hidden
  settingsPanel.hidden = !open
  settingsToggle.setAttribute('aria-expanded', String(open))
})

document.addEventListener('click', (event) => {
  const target = event.target
  if (!(target instanceof Node)) return
  if (settingsToggle.contains(target) || settingsPanel.contains(target)) return
  closeSettings()
})

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSettings()
})

fontSelect.addEventListener('change', () => {
  appearance = { ...appearance, fontId: fontSelect.value }
  commitAppearance()
})

backgroundColor.addEventListener('input', () => {
  appearance = { ...appearance, background: backgroundColor.value }
  commitAppearance()
})

function closeSettings(): void {
  settingsPanel.hidden = true
  settingsToggle.setAttribute('aria-expanded', 'false')
}

function commitAppearance(): void {
  applyAppearance(appearance)
  saveAppearance(appearance)
  wheel.setPalette(appearance.paletteId)
}

function renderPaletteOptions(): void {
  paletteList.replaceChildren(
    ...WHEEL_PALETTES.map((palette) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'palette-option'
      button.dataset.paletteId = palette.id
      button.setAttribute('role', 'option')
      button.setAttribute('aria-selected', String(palette.id === appearance.paletteId))
      const name = document.createElement('span')
      name.textContent = palette.label
      const swatches = document.createElement('span')
      swatches.className = 'palette-swatches'
      for (const color of palette.colors) {
        const chip = document.createElement('span')
        chip.style.background = color
        swatches.append(chip)
      }
      button.append(name, swatches)
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        appearance = { ...appearance, paletteId: palette.id }
        commitAppearance()
        for (const option of paletteList.querySelectorAll<HTMLButtonElement>('.palette-option')) {
          option.setAttribute('aria-selected', String(option.dataset.paletteId === palette.id))
        }
      })
      return button
    }),
  )
}

modeDirect.addEventListener('click', () => {
  changeMode('direct')
})

modeEvent.addEventListener('click', () => {
  changeMode('event')
})

modeDouble.addEventListener('click', () => {
  changeMode('double')
})

function changeMode(mode: Session['mode']): void {
  if (spinning || session.mode === mode) return
  session = switchMode(session, mode)
  showingResult = false
  landedWheel = null
  save()
  render()
}

eventTitle.addEventListener('input', () => {
  session = setEventTitle(session, eventTitle.value)
  save()
})

namesField.addEventListener('input', () => {
  if (session.mode === 'double') return
  session = setNameText(session, namesField.value).session
  save()
  render()
})

leftField.addEventListener('input', () => {
  if (!isDoubleSession(session)) return
  session = setDoubleText(session, 'left', leftField.value).session
  save()
  render()
})

rightField.addEventListener('input', () => {
  if (!isDoubleSession(session)) return
  session = setDoubleText(session, 'right', rightField.value).session
  save()
  render()
})

doubleExciting.addEventListener('change', () => {
  if (!isDoubleSession(session)) return
  session = setDoubleExciting(session, doubleExciting.checked)
  save()
})

directRepeat.addEventListener('change', () => {
  session = setDirectRepeatable(session, directRepeat.checked)
  save()
})

addSpinButton.addEventListener('click', () => {
  if (!isEventSession(session) || spinning) return
  session = addSpin(session)
  save()
  render()
})

spinList.addEventListener('input', (event) => {
  if (!isEventSession(session)) return
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  const id = target.closest<HTMLElement>('[data-spin-id]')?.dataset.spinId
  if (!id) return
  if (target.classList.contains('spin-title')) {
    session = updateSpin(session, id, { title: target.value })
    save()
    renderStatus()
    return
  }
  if (target.classList.contains('spin-repeat')) {
    session = updateSpin(session, id, { repeatable: target.checked })
    save()
    return
  }
  if (target.classList.contains('spin-exciting')) {
    session = updateSpin(session, id, { exciting: target.checked })
    save()
  }
})

spinList.addEventListener('click', (event) => {
  if (!isEventSession(session) || spinning) return
  const button = (event.target as HTMLElement).closest('button')
  const id = button?.closest<HTMLElement>('[data-spin-id]')?.dataset.spinId
  if (!button || !id) return
  if (button.dataset.action === 'remove') session = removeSpin(session, id)
  if (button.dataset.action === 'up') session = moveSpin(session, id, -1)
  if (button.dataset.action === 'down') session = moveSpin(session, id, 1)
  save()
  render()
})

spinButton.addEventListener('click', () => {
  void runSpin()
})

liveName.addEventListener('click', () => {
  if (showingResult) return
  void runSpin()
})

document.addEventListener('keydown', (event) => {
  if (event.key !== ' ' && event.code !== 'Space') return
  const target = event.target
  if (target instanceof HTMLElement) {
    const tag = target.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable) return
  }
  if (!showingResult || spinning) return
  event.preventDefault()
  dismissResult()
})

const stage = document.querySelector<HTMLElement>('.stage')!
stage.addEventListener('click', () => {
  dismissResult()
})

function dismissResult(): void {
  if (!showingResult || spinning) return
  showingResult = false
  landedWheel = null
  render()
}

resetButton.addEventListener('click', () => {
  if (spinning) return
  session = resetDraws(session)
  showingResult = false
  landedWheel = null
  save()
  render()
})

const frame = document.querySelector<HTMLElement>('.wheel-frame')!
const observer = new ResizeObserver(() => wheel.resize())
observer.observe(frame)

render()

async function runSpin(): Promise<void> {
  if (spinning || spinBlockReason(session)) return
  if (session.mode === 'double') {
    const pairs = buildMatching(session.leftNames, session.rightNames)
    spinning = true
    showingResult = false
    render()
    await cycleSides(pairs, session.exciting, (side, label) => {
      if (side === 'left') pairLeft.textContent = label
      else pairRight.textContent = label
    })
    session = commitMatching(session, pairs)
    spinning = false
    showingResult = true
    save()
    render()
    return
  }
  const pool = activeNames(session)
  const winner = pickWinner(pool)
  const index = pool.findIndex((entry) => entry.id === winner.id)
  landedWheel = pool
  spinning = true
  render()
  const exciting = session.mode === 'event' && currentSpin(session)?.exciting === true
  await wheel.spinTo(index, exciting)
  session = commitResult(session, winner)
  spinning = false
  showingResult = true
  save()
  render()
}

function save(): void {
  saveSession(session)
}

function render(): void {
  const event = isEventSession(session)
  const double = isDoubleSession(session)
  modeDirect.setAttribute('aria-pressed', String(session.mode === 'direct'))
  modeEvent.setAttribute('aria-pressed', String(event))
  modeDouble.setAttribute('aria-pressed', String(double))
  eventTitleField.hidden = !event
  eventSpins.hidden = !event
  directRepeatField.hidden = session.mode !== 'direct'
  progress.hidden = !event
  namesLabel.hidden = double
  count.hidden = double
  namesHint.hidden = double
  doubleFields.hidden = !double
  rosterField.hidden = double
  if (session.mode === 'event') syncField(eventTitle, session.title)
  if (isDoubleSession(session)) {
    syncField(leftField, session.leftText)
    syncField(rightField, session.rightText)
    doubleExciting.checked = session.exciting
  } else {
    syncField(namesField, session.nameText)
  }
  if (session.mode === 'direct') directRepeat.checked = session.repeatable
  namesField.disabled = spinning
  leftField.disabled = spinning
  rightField.disabled = spinning
  doubleExciting.disabled = spinning
  directRepeat.disabled = spinning
  eventTitle.disabled = spinning
  modeDirect.disabled = spinning
  modeEvent.disabled = spinning
  modeDouble.disabled = spinning
  addSpinButton.disabled = spinning
  renderSpins()
  renderPairStage()
  renderStatus()
  renderHistory()
  renderRoster()
  if (session.mode !== 'double') {
    wheel.setSlices(showingResult && landedWheel ? landedWheel : activeNames(session))
  }
}

function renderSpins(): void {
  if (!isEventSession(session)) {
    spinList.replaceChildren()
    delete spinList.dataset.signature
    return
  }
  const signature = `${session.currentSpinIndex}:${session.spins.map((spin) => spin.id).join(',')}`
  if (spinList.dataset.signature === signature) {
    updateSpinRowState()
    return
  }
  spinList.dataset.signature = signature
  spinList.replaceChildren(
    ...session.spins.map((spin, index) => {
      const row = document.createElement('li')
      row.className = 'spin-row'
      row.dataset.spinId = spin.id
      row.innerHTML = `
        <span class="spin-index">${index + 1}</span>
        <input class="spin-title" type="text" value="" aria-label="Spin ${index + 1} name" />
        <div class="spin-actions">
          <label class="check"><input class="spin-repeat" type="checkbox" /> Repeatable</label>
          <label class="check"><input class="spin-exciting" type="checkbox" /> Exciting!</label>
          <button type="button" data-action="up" aria-label="Move spin ${index + 1} up">Up</button>
          <button type="button" data-action="down" aria-label="Move spin ${index + 1} down">Down</button>
          <button type="button" data-action="remove" aria-label="Remove spin ${index + 1}">Remove</button>
        </div>
      `
      const title = row.querySelector<HTMLInputElement>('.spin-title')!
      const repeat = row.querySelector<HTMLInputElement>('.spin-repeat')!
      const exciting = row.querySelector<HTMLInputElement>('.spin-exciting')!
      title.value = spin.title
      repeat.checked = spin.repeatable
      exciting.checked = spin.exciting
      return row
    }),
  )
  updateSpinRowState()
}

function updateSpinRowState(): void {
  if (session.mode !== 'event') return
  const currentSpinIndex = session.currentSpinIndex
  const rows = [...spinList.querySelectorAll<HTMLElement>('.spin-row')]
  rows.forEach((row, index) => {
    const done = index < currentSpinIndex
    const upcoming = index >= currentSpinIndex
    row.classList.toggle('is-current', index === currentSpinIndex)
    row.classList.toggle('is-done', done)
    row.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
      input.disabled = spinning || done
    })
    row.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
      const action = button.dataset.action
      const atEdge = (action === 'up' && index === currentSpinIndex) || (action === 'down' && index === rows.length - 1)
      button.disabled = spinning || !upcoming || atEdge
    })
  })
}

function renderPairStage(): void {
  const double = session.mode === 'double'
  pairStage.hidden = !double
  frame.hidden = double
  resultRow.hidden = double
  liveMeta.hidden = double
  if (session.mode !== 'double') return
  pairLeft.classList.toggle('is-spinning', spinning)
  pairRight.classList.toggle('is-spinning', spinning)
  pairLeft.classList.toggle('is-result', !spinning && showingResult)
  pairRight.classList.toggle('is-result', !spinning && showingResult)
  if (spinning) {
    pairLeft.textContent = '…'
    pairRight.textContent = '…'
    pairList.hidden = true
    pairList.replaceChildren()
    return
  }
  const matching = showingResult ? session.results[session.results.length - 1] : undefined
  pairList.hidden = !matching
  if (!matching || matching.length === 0) {
    pairLeft.textContent = 'Ready'
    pairRight.textContent = 'Ready'
    pairList.replaceChildren()
    return
  }
  const last = matching[matching.length - 1]
  pairLeft.textContent = last.left
  pairRight.textContent = last.right
  pairList.replaceChildren(...matching.map(pairRow))
}

function pairRow(pair: Pair): HTMLLIElement {
  const item = document.createElement('li')
  const left = document.createElement('span')
  const join = document.createElement('span')
  const right = document.createElement('span')
  left.textContent = pair.left
  join.className = 'pair-join'
  join.textContent = '·'
  right.textContent = pair.right
  item.append(left, join, right)
  return item
}

function renderStatus(): void {
  const reason = spinBlockReason(session)
  const double = session.mode === 'double'
  if (session.mode === 'double') {
    const left = parseNameLabels(session.leftText)
    const right = parseNameLabels(session.rightText)
    leftCount.textContent = `${left.labels.length}/${MAX_NAMES}`
    rightCount.textContent = `${right.labels.length}/${MAX_NAMES}`
    leftCount.classList.toggle('is-over', left.overLimit)
    rightCount.classList.toggle('is-over', right.overLimit)
    status.textContent = reason ?? ''
  } else {
    const parsed = parseNameLabels(session.nameText)
    const extra = parsed.labels.length - MAX_NAMES
    count.textContent = `${parsed.labels.length}/${MAX_NAMES}`
    count.classList.toggle('is-over', parsed.overLimit)
    status.textContent = parsed.overLimit
      ? `${extra} ${extra === 1 ? 'name' : 'names'} over the limit of ${MAX_NAMES}. The wheel was not updated.`
      : (reason ?? '')
  }
  status.classList.toggle('is-alert', status.textContent.length > 0)
  spinButton.disabled = spinning || Boolean(reason)
  liveName.disabled = spinning
  liveName.classList.toggle('is-spinning', spinning)
  liveName.classList.toggle('is-result', !spinning && showingResult)
  liveName.classList.toggle('is-ready', !spinning && !showingResult)
  spinHint.textContent = double
    ? 'Tap the boxes or press the space bar for the next spin'
    : 'Tap the wheel or press the space bar for the next spin'
  spinHint.hidden = spinning || !showingResult
  stage.classList.toggle('can-continue', !spinning && showingResult)
  const hasDraws = session.mode === 'double'
    ? session.results.length > 0
    : session.results.length > 0 || session.removedIds.length > 0
  resetButton.disabled = spinning || !hasDraws
  if (session.mode === 'double') return

  if (spinning) {
    liveName.textContent = 'Wait for it...'
    liveMeta.textContent = session.mode === 'event' ? eventSpinCaption() : ''
    return
  }

  if (isEventSession(session)) {
    const total = session.spins.length
    const spin = currentSpin(session)
    progress.textContent = spin
      ? `${session.currentSpinIndex + 1} of ${total} · ${spin.title.trim() || 'Untitled spin'}`
      : total === 0
        ? 'No spins yet'
        : 'Event complete'
  }

  const last = session.results[session.results.length - 1]
  if (showingResult && last) {
    liveName.textContent = last.name
    liveMeta.textContent =
      session.mode === 'event'
        ? eventSpinCaption()
        : (last.spinTitle ?? (last.repeatable ? 'Repeatable pick' : 'Removed from the wheel'))
    return
  }
  liveName.textContent = 'Ready'
  liveMeta.textContent = session.mode === 'event' ? eventSpinCaption() : ''
}

function eventSpinCaption(): string {
  if (session.mode !== 'event') return ''
  const spin = currentSpin(session)
  if (spin) return spin.title.trim() || 'Untitled spin'
  if (session.spins.length > 0) return 'All spins complete'
  return ''
}

function renderHistory(): void {
  if (isDoubleSession(session)) {
    const pairs = session.results.flat()
    if (pairs.length === 0) {
      history.innerHTML = '<li><span>No spins yet</span></li>'
      return
    }
    history.replaceChildren(
      ...pairs.map((pair) => {
        const item = document.createElement('li')
        const label = document.createElement('span')
        label.textContent = `${pair.left} · ${pair.right}`
        item.append(label)
        return item
      }),
    )
    return
  }
  if (session.results.length === 0) {
    history.innerHTML = '<li><span>No spins yet</span></li>'
    return
  }
  history.replaceChildren(
    ...session.results.map((result) => {
      const item = document.createElement('li')
      const label = document.createElement('span')
      label.textContent = result.spinTitle ? `${result.spinTitle} · ${result.name}` : result.name
      const note = document.createElement('span')
      note.textContent = result.repeatable ? 'Stayed' : 'Removed'
      item.append(label, note)
      return item
    }),
  )
}

function renderRoster(): void {
  if (session.mode === 'double') return
  const removed = new Set(session.removedIds)
  if (session.names.length === 0) {
    roster.innerHTML = '<li><span>No names on the wheel</span></li>'
    return
  }
  roster.replaceChildren(
    ...session.names.map((entry) => {
      const item = document.createElement('li')
      item.textContent = entry.label
      item.classList.toggle('is-out', removed.has(entry.id))
      return item
    }),
  )
}

function syncField(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  if (document.activeElement !== field && field.value !== value) field.value = value
}
