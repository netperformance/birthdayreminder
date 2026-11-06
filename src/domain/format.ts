import { weekday, type Day } from './dates'
import type { Lang } from './lang'

/**
 * Datum und Uhrzeit als Text, ohne Intl, damit es auf jedem Handy gleich aussieht.
 * - Deutsch: "Sa, 7. Nov.", "Samstag, 14. November", "14.11.1989", immer 24 Stunden.
 * - Englisch USA: "Sat, Nov 7", "Saturday, November 14", "11/14/1989".
 * - Englisch Großbritannien, Australien und andere: "Sat 7 Nov", "Saturday 14 November", "14/11/1989".
 * - Englisch: Uhrzeit nach der Einstellung von Android, "9:00 AM" oder "09:00".
 */
export interface DateStyle {
  lang: Lang
  /** Tag vor Monat (überall außer Englisch USA). */
  dayFirst: boolean
  h24: boolean
}

const MONTHS: Record<Lang, string[]> = {
  de: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
}
const MONTHS_SHORT: Record<Lang, string[]> = {
  de: ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
}
const WEEKDAYS: Record<Lang, string[]> = {
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
}
const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
}

export const monthName = (m: number, lang: Lang) => MONTHS[lang][m - 1]
export const weekdayName = (day: Day, lang: Lang) => WEEKDAYS[lang][weekday(day)]

/** Tag und Monat ohne Jahr: "7. Nov." oder "Nov 7". */
export function dayMonthShort(day: Pick<Day, 'm' | 'd'>, s: DateStyle): string {
  const mon = MONTHS_SHORT[s.lang][day.m - 1]
  if (s.lang === 'de') return `${day.d}. ${mon}`
  return s.dayFirst ? `${day.d} ${mon}` : `${mon} ${day.d}`
}

/** "Sa, 7. Nov." oder "Sat, Nov 7" oder "Sat 7 Nov". */
export function shortDate(day: Day, s: DateStyle): string {
  const wd = WEEKDAYS_SHORT[s.lang][weekday(day)]
  return s.lang === 'en' && s.dayFirst ? `${wd} ${dayMonthShort(day, s)}` : `${wd}, ${dayMonthShort(day, s)}`
}

/** Tag und Monat ausgeschrieben: "14. November" oder "November 14". */
export function dayMonthLong(day: Pick<Day, 'm' | 'd'>, s: DateStyle): string {
  const mon = MONTHS[s.lang][day.m - 1]
  if (s.lang === 'de') return `${day.d}. ${mon}`
  return s.dayFirst ? `${day.d} ${mon}` : `${mon} ${day.d}`
}

/** "Samstag, 14. November" oder "Saturday, November 14" oder "Saturday 14 November". */
export function longDate(day: Day, s: DateStyle): string {
  const wd = weekdayName(day, s.lang)
  return s.lang === 'en' && s.dayFirst ? `${wd} ${dayMonthLong(day, s)}` : `${wd}, ${dayMonthLong(day, s)}`
}

/** Geburtsdatum mit Jahr: "14.11.1989", "11/14/1989" oder "14/11/1989". Ohne Jahr: "14. Nov." usw. */
export function birthDate(d: number, m: number, y: number | null, s: DateStyle): string {
  if (y === null) return dayMonthShort({ d, m }, s)
  const dd = String(d).padStart(2, '0')
  const mm = String(m).padStart(2, '0')
  if (s.lang === 'de') return `${dd}.${mm}.${y}`
  return s.dayFirst ? `${dd}/${mm}/${y}` : `${mm}/${dd}/${y}`
}

/** "09:00" oder "9:00 AM". */
export function time(minute: number, s: DateStyle): string {
  const h = Math.floor(minute / 60) % 24
  const mm = String(minute % 60).padStart(2, '0')
  if (s.lang === 'de' || s.h24) return `${String(h).padStart(2, '0')}:${mm}`
  return `${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`
}

/**
 * Datumsreihenfolge für Englisch aus der Region des Handys. Englisch mit Region USA (oder ohne
 * Region) zeigt den Monat zuerst, Englisch mit Region Großbritannien, Australien und andere den
 * Tag zuerst. Ist das Handy auf eine andere Sprache gestellt (z. B. "de-DE") und nur die App auf
 * Englisch, gilt die Reihenfolge der USA.
 */
export function dayFirstFor(locale: string | undefined | null): boolean {
  const m = /^([a-z]{2,3})(?:[-_](?:[A-Za-z]{4}[-_])?([A-Za-z]{2}))?/i.exec((locale ?? '').trim())
  if (!m || m[1].toLowerCase() !== 'en' || !m[2]) return false
  return !['US', 'PH', 'FM', 'MH', 'PW', 'GU', 'AS', 'PR', 'VI', 'UM', 'MP'].includes(m[2].toUpperCase())
}
