import { dayMonthShort, shortDate, time, weekdayName, type DateStyle } from '../domain/format'
import type { Lang } from '../domain/lang'
import { signOf, SIGN_NAMES, SYMBOLS } from '../domain/zodiac'
import { zoneCity, type LocalTime } from '../domain/zone'

/** Länder für die häufigsten Zonen "Zuhause", damit dort "Deutschland" statt "Berlin" steht. */
const COUNTRIES: Record<string, Record<Lang, string>> = {
  'Europe/Berlin': { de: 'Deutschland', en: 'Germany' },
  'Europe/Vienna': { de: 'Österreich', en: 'Austria' },
  'Europe/Zurich': { de: 'der Schweiz', en: 'Switzerland' },
  'Europe/Busingen': { de: 'Deutschland', en: 'Germany' },
}

/** Name einer Zone im Satz: "Deutschland" für Berlin, sonst der Ort ("Sydney"). */
export function placeName(zone: string, lang: Lang): string {
  return COUNTRIES[zone]?.[lang] ?? zoneCity(zone)
}

/** Name einer Zone als Überschrift: "Deutschland" ohne Artikel. */
export function placeTitle(zone: string, lang: Lang): string {
  const p = placeName(zone, lang)
  return p.startsWith('der ') ? p.slice(4) : p
}

export function signLabel(month: number, day: number, lang: Lang): { symbol: string; name: string; full: string } {
  const s = signOf(month, day)
  return { symbol: SYMBOLS[s], name: SIGN_NAMES[lang][s], full: `${SYMBOLS[s]} ${SIGN_NAMES[lang][s]}` }
}

/** "Freitag, 00:01" bzw. "Friday, 12:01 AM". */
export function weekdayTime(t: LocalTime, s: DateStyle): string {
  return `${weekdayName(t, s.lang)}, ${time(t.minute, s)}`
}

/** Stunden mit Komma, wo nötig ("4,5"). */
export function hoursText(minutes: number, lang: Lang): string {
  const h = Math.abs(minutes) / 60
  const text = Number.isInteger(h) ? String(h) : h.toFixed(1)
  return lang === 'de' ? text.replace('.', ',') : text
}

export { dayMonthShort, shortDate, time }
