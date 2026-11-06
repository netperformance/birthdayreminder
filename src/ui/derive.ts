import type { DoneMap } from '../../modules/birthday-alarms'
import { dayKey } from '../domain/dates'
import type { Person } from '../domain/model'
import { nextBirthday, todayState, type BirthdayWindow, type ScheduleContext } from '../domain/schedule'

export interface TodayCard {
  person: Person
  kind: 'today' | 'soon'
  window: BirthdayWindow
  /** Uhrzeit von "Beenden", falls schon getippt. */
  doneAt: number | null
}

export interface ListItem {
  person: Person
  window: BirthdayWindow
  days: number
}

export interface Section {
  key: string
  month: number
  items: ListItem[]
}

/** Startseite: Karten für heute und die übrigen Einträge nach Monaten, beginnend beim nächsten Geburtstag. */
export function deriveHome(people: Person[], now: number, ctx: ScheduleContext, done: DoneMap) {
  const cards: TodayCard[] = []
  const items: ListItem[] = []
  for (const p of people) {
    const state = todayState(p, now, ctx)
    if (state) {
      const d = done[p.id]
      cards.push({ person: p, kind: state.kind, window: state.window, doneAt: d && d.date === dayKey(state.window.day) ? d.at : null })
      continue
    }
    const next = nextBirthday(p, now, ctx)
    items.push({ person: p, window: next.window, days: next.days })
  }
  cards.sort((a, b) => (a.kind === b.kind ? a.person.name.localeCompare(b.person.name) : a.kind === 'today' ? -1 : 1))
  items.sort((a, b) => a.window.start - b.window.start || a.person.name.localeCompare(b.person.name))
  const sections: Section[] = []
  for (const it of items) {
    const key = `${it.window.day.y}-${it.window.day.m}`
    const last = sections[sections.length - 1]
    if (last && last.key === key) last.items.push(it)
    else sections.push({ key, month: it.window.day.m, items: [it] })
  }
  return { cards, sections, items }
}
