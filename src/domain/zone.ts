import { dayNumber, fromDayNumber, type Day } from './dates'

/**
 * Zeitzonen. Die eigentlichen Regeln (Sommerzeit, Abstände) kommen von Android über das
 * eigene Modul, in den Tests von Node. Hier steht nur die Umrechnung darauf.
 */
export interface ZoneInfo {
  /** Abstand der Zone zu UTC in Minuten zu einem Zeitpunkt (Berlin im Winter: 60). */
  offsetMinutes(zone: string, epochMs: number): number
}

export interface LocalTime extends Day {
  /** Minuten nach Mitternacht. */
  minute: number
}

const MIN = 60_000

/** Ortszeit in einer Zone zu einem Zeitpunkt. */
export function localTime(epochMs: number, zone: string, info: ZoneInfo): LocalTime {
  const shifted = epochMs + info.offsetMinutes(zone, epochMs) * MIN
  const days = Math.floor(shifted / 86_400_000)
  const minute = Math.floor((shifted - days * 86_400_000) / MIN)
  return { ...fromDayNumber(days), minute }
}

export const localDay = (epochMs: number, zone: string, info: ZoneInfo): Day => {
  const { y, m, d } = localTime(epochMs, zone, info)
  return { y, m, d }
}

/**
 * Zeitpunkt einer Ortszeit in einer Zone.
 * - Gibt es die Uhrzeit wegen der Umstellung auf Sommerzeit nicht (02:30), gilt der
 *   Moment der Umstellung (03:00).
 * - Gibt es sie zweimal (Herbst), gilt die erste.
 */
export function instantOf(day: Day, minute: number, zone: string, info: ZoneInfo): number {
  const wall = (dayNumber(day) * 1440 + minute) * MIN
  const offsets = new Set<number>()
  for (const probe of [wall - 14 * 60 * MIN, wall, wall + 14 * 60 * MIN]) offsets.add(info.offsetMinutes(zone, probe))
  const valid = [...offsets]
    .map((o) => wall - o * MIN)
    .filter((t) => info.offsetMinutes(zone, t) * MIN + t === wall)
    .sort((a, b) => a - b)
  if (valid.length) return valid[0]
  // Lücke: Umstellungszeitpunkt zwischen den beiden Kandidaten suchen.
  const cands = [...offsets].map((o) => wall - o * MIN).sort((a, b) => a - b)
  let lo = cands[0]
  let hi = cands[cands.length - 1]
  const startOffset = info.offsetMinutes(zone, lo)
  while (hi - lo > MIN) {
    const mid = lo + Math.floor((hi - lo) / 2 / MIN) * MIN
    if (info.offsetMinutes(zone, mid) === startOffset) lo = mid
    else hi = mid
  }
  return hi
}

/** Unterschied zweier Zonen in Minuten zu einem Zeitpunkt (Sydney gegenüber Berlin im November: 600). */
export const zoneDifference = (a: string, b: string, epochMs: number, info: ZoneInfo) =>
  info.offsetMinutes(a, epochMs) - info.offsetMinutes(b, epochMs)

/** Name einer Zone zum Anzeigen: der Ort nach dem letzten Schrägstrich ("America/Los_Angeles" wird "Los Angeles"). */
export function zoneCity(zone: string): string {
  const part = zone.split('/').pop() ?? zone
  return part.replaceAll('_', ' ')
}

/**
 * Zonen über Intl (Node, Browser, Hermes). Wird verwendet, wenn das Modul von Android fehlt,
 * zum Beispiel in den Tests.
 */
export const intlZoneInfo: ZoneInfo = {
  offsetMinutes(zone, epochMs) {
    const dtf = formatterFor(zone)
    const parts = Object.fromEntries(dtf.formatToParts(new Date(epochMs)).map((p) => [p.type, p.value]))
    const hour = Number(parts.hour) % 24
    const asUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour, Number(parts.minute), Number(parts.second))
    return Math.round((asUtc - Math.floor(epochMs / 1000) * 1000) / MIN)
  },
}

const formatters = new Map<string, Intl.DateTimeFormat>()
function formatterFor(zone: string): Intl.DateTimeFormat {
  let f = formatters.get(zone)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    })
    formatters.set(zone, f)
  }
  return f
}
