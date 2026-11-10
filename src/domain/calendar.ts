import { birthdayIn, daysInMonth, weekday } from './dates'
import type { Feb29 } from './model'

/** Monat in einem Jahr. month: 1 bis 12. */
export interface YearMonth {
  year: number
  month: number
}

/** Einen Monat weiter oder zurück (n darf negativ sein). */
export function addMonths({ year, month }: YearMonth, n: number): YearMonth {
  const i = year * 12 + (month - 1) + n
  return { year: Math.floor(i / 12), month: (((i % 12) + 12) % 12) + 1 }
}

/**
 * Felder des Kalenderblatts, die Woche beginnt am Montag.
 * Leere Felder vor dem 1. und nach dem letzten Tag sind null, die Länge ist ein Vielfaches von 7.
 */
export function monthGrid({ year, month }: YearMonth): (number | null)[] {
  const lead = (weekday({ y: year, m: month, d: 1 }) + 6) % 7
  const cells: (number | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= daysInMonth(year, month); d++) cells.push(d)
  while (cells.length % 7) cells.push(null)
  return cells
}

/**
 * Wer in diesem Monat Geburtstag hat, nach Tag. Der 29. Februar folgt in Jahren ohne
 * Schalttag der Einstellung (28. Februar oder 1. März), wie überall in der App.
 */
export function birthdaysInMonth<P extends { day: number; month: number }>(people: P[], ym: YearMonth, feb29: Feb29): Map<number, P[]> {
  const map = new Map<number, P[]>()
  for (const p of people) {
    const d = birthdayIn(ym.year, p.month, p.day, feb29)
    if (d.m !== ym.month) continue
    const list = map.get(d.d)
    if (list) list.push(p)
    else map.set(d.d, [p])
  }
  return map
}
