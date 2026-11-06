import { addDays, ageIn, birthdayIn, dayNumber, minusOffset, sameDay, type Day } from './dates'
import type { Feb29, Person, Reminder } from './model'
import { instantOf, localDay, localTime, type ZoneInfo } from './zone'

/**
 * Wann ein Geburtstag ist und wann seine Erinnerungen kommen.
 *
 * Regeln (siehe README, Abschnitt Zeitzonen):
 * - Ein Geburtstag dauert von 00:00 bis 24:00 in der Zeitzone der Person. Ohne eigene
 *   Zeitzone gilt "Zuhause". Wo das Handy gerade ist, spielt dafür keine Rolle.
 * - "Am Tag" kommt zur eingestellten Uhrzeit in der Zeit der Person. Liegt die bei dir in
 *   der Nacht (22 bis 7 Uhr) und unterscheiden sich die Zonen, kommt sie um 07:00 bei dir,
 *   solange der Geburtstag noch läuft.
 * - Vorab-Erinnerungen kommen zur eingestellten Uhrzeit in deiner Ortszeit.
 *
 * Dieselben Regeln stehen in Kotlin im Modul birthday-alarms (Planner.kt). Wer hier etwas
 * ändert, ändert es dort auch.
 */
export interface ScheduleContext {
  homeZone: string
  /** Zeitzone, in der das Handy gerade ist. */
  myZone: string
  feb29: Feb29
  info: ZoneInfo
}

export interface BirthdayWindow {
  day: Day
  start: number
  end: number
  /** Alter an diesem Geburtstag, null ohne Geburtsjahr. */
  age: number | null
}

export const zoneOf = (p: Pick<Person, 'zone'>, ctx: ScheduleContext) => p.zone ?? ctx.homeZone

export const NIGHT_START = 22 * 60
export const NIGHT_END = 7 * 60

type Birth = Pick<Person, 'day' | 'month' | 'year' | 'zone'>

export function windowFor(p: Birth, year: number, ctx: ScheduleContext): BirthdayWindow {
  const day = birthdayIn(year, p.month, p.day, ctx.feb29)
  const zone = zoneOf(p, ctx)
  return { day, start: instantOf(day, 0, zone, ctx.info), end: instantOf(addDays(day, 1), 0, zone, ctx.info), age: ageIn(p.year, year) }
}

/** Im Geburtsjahr und davor gibt es keinen Geburtstag (Alter 0 wäre der Tag der Geburt). */
const exists = (p: Birth, year: number) => p.year === null || year > p.year

export type TodayState = { kind: 'today'; window: BirthdayWindow } | { kind: 'soon'; window: BirthdayWindow }

/**
 * "today": bei der Person ist gerade Geburtstag.
 * "soon": bei dir ist schon der Kalendertag des Geburtstags, bei der Person hat er noch nicht
 * begonnen (du bist der Person voraus, z. B. in Sydney).
 */
export function todayState(p: Birth, now: number, ctx: ScheduleContext): TodayState | null {
  const there = localDay(now, zoneOf(p, ctx), ctx.info)
  for (const y of [there.y - 1, there.y, there.y + 1]) {
    if (!exists(p, y)) continue
    const w = windowFor(p, y, ctx)
    if (now >= w.start && now < w.end) return { kind: 'today', window: w }
  }
  const here = localDay(now, ctx.myZone, ctx.info)
  if (exists(p, here.y)) {
    const w = windowFor(p, here.y, ctx)
    if (sameDay(w.day, here) && now < w.start) return { kind: 'soon', window: w }
  }
  return null
}

/**
 * Nächster Geburtstag, der noch nicht vorbei ist, und wie viele Kalendertage es bei dir bis zu
 * seinem Beginn sind. Zu Hause sind das einfach die Tage bis zum Datum. Unterwegs zählt, an
 * welchem deiner Tage der Geburtstag beginnt (in Sydney beginnt ein deutscher Samstag schon
 * Samstag um 10:00, in Los Angeles schon Freitag um 15:00).
 */
export function nextBirthday(p: Birth, now: number, ctx: ScheduleContext): { window: BirthdayWindow; days: number } {
  const there = localDay(now, zoneOf(p, ctx), ctx.info)
  const days = (w: BirthdayWindow) => (now >= w.start ? 0 : Math.max(0, dayNumber(localDay(w.start, ctx.myZone, ctx.info)) - dayNumber(localDay(now, ctx.myZone, ctx.info))))
  for (const y of [there.y - 1, there.y, there.y + 1, there.y + 2]) {
    if (!exists(p, y)) continue
    const w = windowFor(p, y, ctx)
    if (w.end > now) return { window: w, days: days(w) }
  }
  // Geburtsjahr in der Zukunft: erster Geburtstag
  const w = windowFor(p, (p.year ?? there.y) + 1, ctx)
  return { window: w, days: days(w) }
}

/** Zeitpunkt einer Erinnerung für den Geburtstag im Jahr `year`. */
export function occurrence(p: Birth, r: Pick<Reminder, 'offset' | 'minute'>, year: number, ctx: ScheduleContext): number {
  const w = windowFor(p, year, ctx)
  if (r.offset.n > 0) return instantOf(minusOffset(w.day, r.offset), r.minute, ctx.myZone, ctx.info)
  const zone = zoneOf(p, ctx)
  const t = instantOf(w.day, r.minute, zone, ctx.info)
  if (ctx.info.offsetMinutes(zone, t) === ctx.info.offsetMinutes(ctx.myZone, t)) return t
  const mine = localTime(t, ctx.myZone, ctx.info)
  if (mine.minute >= NIGHT_START || mine.minute < NIGHT_END) {
    const morning = mine.minute >= NIGHT_START ? addDays(mine, 1) : mine
    const shifted = instantOf(morning, NIGHT_END, ctx.myZone, ctx.info)
    if (shifted < w.end) return shifted
  }
  return t
}

/** Nächster Zeitpunkt einer Erinnerung nach `after`. */
export function nextOccurrence(p: Birth, r: Pick<Reminder, 'offset' | 'minute'>, after: number, ctx: ScheduleContext): { at: number; window: BirthdayWindow } | null {
  const there = localDay(after, zoneOf(p, ctx), ctx.info)
  let best: { at: number; window: BirthdayWindow } | null = null
  for (const y of [there.y - 1, there.y, there.y + 1, there.y + 2]) {
    if (!exists(p, y)) continue
    const at = occurrence(p, r, y, ctx)
    if (at > after && (!best || at < best.at)) best = { at, window: windowFor(p, y, ctx) }
  }
  return best
}

/** Die nächste fällige Erinnerung aus einer Liste. */
export function nextOf(p: Birth, list: Reminder[], after: number, ctx: ScheduleContext): { at: number; reminder: Reminder } | null {
  let best: { at: number; reminder: Reminder } | null = null
  for (const r of list) {
    const n = nextOccurrence(p, r, after, ctx)
    if (n && (!best || n.at < best.at)) best = { at: n.at, reminder: r }
  }
  return best
}

/** Ortszeit eines Zeitpunkts in deiner Zone und in der Zone der Person, zum Anzeigen. */
export function bothTimes(p: Birth, at: number, ctx: ScheduleContext) {
  return { mine: localTime(at, ctx.myZone, ctx.info), theirs: localTime(at, zoneOf(p, ctx), ctx.info) }
}
