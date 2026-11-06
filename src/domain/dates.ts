import type { Feb29, Offset } from './model'

/** Ein Kalendertag ohne Uhrzeit und ohne Zeitzone. Monat 1 bis 12. */
export interface Day {
  y: number
  m: number
  d: number
}

export const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0

export function daysInMonth(y: number, m: number): number {
  return [31, isLeap(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1]
}

/** Tage seit dem 1. Januar 1970 (proleptischer gregorianischer Kalender). */
export function dayNumber({ y, m, d }: Day): number {
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

export function fromDayNumber(n: number): Day {
  const date = new Date(n * 86_400_000)
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() }
}

export const addDays = (day: Day, n: number): Day => fromDayNumber(dayNumber(day) + n)

/** Wochentag, 0 = Sonntag. */
export const weekday = (day: Day): number => (((dayNumber(day) + 4) % 7) + 7) % 7

export const sameDay = (a: Day, b: Day) => a.y === b.y && a.m === b.m && a.d === b.d

export const compareDays = (a: Day, b: Day) => dayNumber(a) - dayNumber(b)

export const dayKey = ({ y, m, d }: Day) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Prüft ein eingegebenes Datum. Der 29. Februar ist immer erlaubt, wenn kein Jahr dabei ist. */
export function isValidBirthday(day: number, month: number, year: number | null): boolean {
  if (!Number.isInteger(day) || !Number.isInteger(month) || month < 1 || month > 12 || day < 1) return false
  const max = year === null ? (month === 2 ? 29 : daysInMonth(2000, month)) : daysInMonth(year, month)
  return day <= max
}

/** Der Geburtstag in einem bestimmten Jahr. Der 29. Februar wird in Jahren ohne Schalttag verschoben. */
export function birthdayIn(year: number, month: number, day: number, feb29: Feb29): Day {
  if (month === 2 && day === 29 && !isLeap(year)) return feb29 === 'feb28' ? { y: year, m: 2, d: 28 } : { y: year, m: 3, d: 1 }
  return { y: year, m: month, d: day }
}

/** Ein Tag, um einen Abstand früher. Monate rechnen nach dem Kalender (14. Dez. minus 1 Monat = 14. Nov.). */
export function minusOffset(day: Day, o: Offset): Day {
  if (o.unit === 'd') return addDays(day, -o.n)
  if (o.unit === 'w') return addDays(day, -7 * o.n)
  let y = day.y
  let m = day.m - o.n
  while (m < 1) {
    m += 12
    y -= 1
  }
  return { y, m, d: Math.min(day.d, daysInMonth(y, m)) }
}

/** Alter am Geburtstag im Jahr `y`. */
export const ageIn = (birthYear: number | null, y: number): number | null => (birthYear === null ? null : y - birthYear)

/**
 * Ergänzt eine zweistellige Jahreszahl: bis zum laufenden Jahr ins 21. Jahrhundert, sonst ins 20.
 * "89" wird 1989, "05" wird 2005 (im Jahr 2026).
 */
export function expandYear(text: string, currentYear: number): number | null {
  const digits = text.replace(/\D/g, '')
  if (!digits) return null
  const n = Number(digits)
  if (digits.length <= 2) {
    const century = Math.floor(currentYear / 100) * 100
    return n <= currentYear % 100 ? century + n : century - 100 + n
  }
  return digits.length === 4 ? n : null
}

/**
 * Liest die Eingabe des Geburtsdatums aus einem einzigen Feld: Ziffern laufen der Reihe nach
 * in Tag, Monat und Jahr (oder Monat, Tag, Jahr). Ein Teil ist fertig nach zwei Ziffern, nach
 * einer Ziffer, die nicht zweistellig weitergehen kann ("5" als Tag, "3" als Monat), oder nach
 * einem Trennzeichen (Punkt, Komma, Schrägstrich, Strich, Leerzeichen).
 * Gibt die drei Teile in der Reihenfolge der Eingabe zurück und welcher Teil gerade dran ist.
 */
export function parseDateInput(raw: string, order: ('day' | 'month' | 'year')[]): { parts: [string, string, string]; active: number } {
  const parts: [string, string, string] = ['', '', '']
  let i = 0
  const maxFirst = (f: 'day' | 'month' | 'year') => (f === 'day' ? 3 : f === 'month' ? 1 : 9)
  for (const ch of raw) {
    if (i > 2) break
    if (/[.,/\- ]/.test(ch)) {
      if (parts[i] && i < 2) i++
      continue
    }
    if (!/\d/.test(ch)) continue
    const field = order[i]
    if (field === 'year') {
      if (parts[i].length < 4) parts[i] += ch
      continue
    }
    parts[i] += ch
    if (parts[i].length === 2 || (parts[i].length === 1 && Number(ch) > maxFirst(field))) i++
  }
  return { parts, active: Math.min(i, 2) }
}

/**
 * Eingabe in eines der drei Datumsfelder (Tag, Monat, Jahr), je Tastendruck.
 * `old` ist der bisherige Inhalt, `text` der neue Inhalt des Feldes nach dem Tastendruck.
 * `fresh`: Das Feld wurde gerade angetippt, die erste Ziffer ersetzt den alten Inhalt.
 * `next`: Das Feld ist fertig, es geht ins nächste Feld (beim Jahr: Tastatur schließen).
 * Wo der Cursor stand, spielt keine Rolle: Neue Ziffern kommen immer ans Ende,
 * Löschen nimmt immer die letzte Ziffer.
 */
export function dateFieldInput(field: 'day' | 'month' | 'year', old: string, text: string, fresh: boolean): { value: string; next: boolean } {
  if (text.length < old.length) return { value: old.slice(0, -1), next: false }
  let pre = 0
  while (pre < old.length && old[pre] === text[pre]) pre++
  let suf = 0
  while (suf < old.length - pre && old[old.length - 1 - suf] === text[text.length - 1 - suf]) suf++
  const inserted = text.slice(pre, text.length - suf)
  const digits = inserted.replace(/\D/g, '')
  let value = fresh ? '' : old
  if (!digits) {
    const sep = /[.,/\- ]/.test(inserted)
    return { value, next: sep && !!value && field !== 'year' }
  }
  const maxFirst = field === 'day' ? 3 : 1
  for (const ch of digits) {
    if (field === 'year') {
      if (value.length >= 4) value = ''
      value += ch
      if (value.length === 4) return { value, next: true }
    } else {
      if (value.length >= 2) value = ''
      value += ch
      if (value.length === 2 || (value.length === 1 && Number(ch) > maxFirst)) return { value, next: true }
    }
  }
  return { value, next: false }
}
