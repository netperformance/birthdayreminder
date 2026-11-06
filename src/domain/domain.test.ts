import { describe, expect, it } from 'vitest'
import { birthdayIn, expandYear, isValidBirthday, minusOffset, weekday } from './dates'
import { nextBirthday, nextOccurrence, occurrence, todayState, type ScheduleContext } from './schedule'
import { signOf } from './zodiac'
import { instantOf, intlZoneInfo, localTime } from './zone'

const BERLIN = 'Europe/Berlin'
const ctx = (myZone = BERLIN, home = BERLIN): ScheduleContext => ({ homeZone: home, myZone, feb29: 'feb28', info: intlZoneInfo })
const at = (iso: string) => Date.parse(iso)
const lisa = { day: 6, month: 11, year: 1992, zone: null }
const mehmet = { day: 14, month: 11, year: 1989, zone: null }
const day0900 = { offset: { n: 0, unit: 'd' as const }, minute: 9 * 60 }

describe('Kalender', () => {
  it('kennt Wochentage', () => {
    expect(weekday({ y: 2026, m: 11, d: 6 })).toBe(5) // Freitag
    expect(weekday({ y: 1989, m: 11, d: 14 })).toBe(2) // Dienstag
  })

  it('verschiebt den 29. Februar in Jahren ohne Schalttag', () => {
    expect(birthdayIn(2027, 2, 29, 'feb28')).toEqual({ y: 2027, m: 2, d: 28 })
    expect(birthdayIn(2027, 2, 29, 'mar1')).toEqual({ y: 2027, m: 3, d: 1 })
    expect(birthdayIn(2028, 2, 29, 'mar1')).toEqual({ y: 2028, m: 2, d: 29 })
  })

  it('prüft Eingaben', () => {
    expect(isValidBirthday(29, 2, null)).toBe(true)
    expect(isValidBirthday(29, 2, 1990)).toBe(false)
    expect(isValidBirthday(29, 2, 1992)).toBe(true)
    expect(isValidBirthday(31, 4, null)).toBe(false)
    expect(isValidBirthday(0, 1, null)).toBe(false)
  })

  it('ergänzt zweistellige Jahre', () => {
    expect(expandYear('89', 2026)).toBe(1989)
    expect(expandYear('05', 2026)).toBe(2005)
    expect(expandYear('26', 2026)).toBe(2026)
    expect(expandYear('27', 2026)).toBe(1927)
    expect(expandYear('1974', 2026)).toBe(1974)
    expect(expandYear('', 2026)).toBe(null)
  })

  it('rechnet Monate nach dem Kalender zurück', () => {
    expect(minusOffset({ y: 2026, m: 12, d: 14 }, { n: 1, unit: 'm' })).toEqual({ y: 2026, m: 11, d: 14 })
    expect(minusOffset({ y: 2026, m: 3, d: 31 }, { n: 1, unit: 'm' })).toEqual({ y: 2026, m: 2, d: 28 })
    expect(minusOffset({ y: 2026, m: 1, d: 10 }, { n: 2, unit: 'm' })).toEqual({ y: 2025, m: 11, d: 10 })
    expect(minusOffset({ y: 2026, m: 12, d: 3 }, { n: 2, unit: 'w' })).toEqual({ y: 2026, m: 11, d: 19 })
  })
})

describe('Sternzeichen', () => {
  it('liegt an den Grenzen richtig', () => {
    expect(signOf(11, 6)).toBe('scorpio')
    expect(signOf(11, 22)).toBe('sagittarius')
    expect(signOf(12, 22)).toBe('capricorn')
    expect(signOf(1, 19)).toBe('capricorn')
    expect(signOf(1, 20)).toBe('aquarius')
    expect(signOf(3, 20)).toBe('pisces')
    expect(signOf(3, 21)).toBe('aries')
    expect(signOf(12, 24)).toBe('capricorn')
  })
})

describe('Zeitzonen', () => {
  it('nimmt bei fehlender Uhrzeit (Sommerzeit) den Moment der Umstellung', () => {
    expect(new Date(instantOf({ y: 2027, m: 3, d: 28 }, 150, BERLIN, intlZoneInfo)).toISOString()).toBe('2027-03-28T01:00:00.000Z')
  })

  it('nimmt bei doppelter Uhrzeit (Herbst) die erste', () => {
    expect(new Date(instantOf({ y: 2026, m: 10, d: 25 }, 150, BERLIN, intlZoneInfo)).toISOString()).toBe('2026-10-25T00:30:00.000Z')
  })

  it('rechnet Ortszeit um', () => {
    expect(localTime(at('2026-11-06T08:00:00Z'), 'Australia/Sydney', intlZoneInfo)).toEqual({ y: 2026, m: 11, d: 6, minute: 19 * 60 })
  })
})

describe('Geburtstag zählt nach Zuhause', () => {
  it('zu Hause: Lisa hat am 6. November Geburtstag', () => {
    expect(todayState(lisa, at('2026-11-06T09:00:00Z'), ctx())?.kind).toBe('today')
    expect(todayState(lisa, at('2026-11-05T22:59:00Z'), ctx())).toBe(null)
  })

  it('Los Angeles: in Deutschland ist schon Freitag 00:01, also ist heute Geburtstag', () => {
    const now = at('2026-11-05T23:01:00Z') // Berlin Fr 00:01, LA Do 15:01
    expect(todayState(lisa, now, ctx('America/Los_Angeles'))?.kind).toBe('today')
  })

  it('Sydney: dort ist Freitag, in Deutschland erst Donnerstag 23:00, also beginnt der Geburtstag gleich', () => {
    const now = at('2026-11-05T22:00:00Z') // Sydney Fr 09:00, Berlin Do 23:00
    expect(todayState(lisa, now, ctx('Australia/Sydney'))?.kind).toBe('soon')
    expect(todayState(lisa, at('2026-11-05T23:00:00Z'), ctx('Australia/Sydney'))?.kind).toBe('today')
  })

  it('eine Person mit eigener Zeitzone hat nach ihrer Zeit Geburtstag', () => {
    const ben = { day: 6, month: 11, year: 1997, zone: 'Australia/Sydney' }
    expect(todayState(ben, at('2026-11-05T14:00:00Z'), ctx())?.kind).toBe('today') // Sydney Fr 01:00
  })

  it('zählt die Tage bis zum nächsten Geburtstag', () => {
    expect(nextBirthday(mehmet, at('2026-11-06T09:00:00Z'), ctx()).days).toBe(8)
    expect(nextBirthday(lisa, at('2026-11-06T09:00:00Z'), ctx()).days).toBe(0)
    expect(nextBirthday({ day: 9, month: 1, year: 1995, zone: null }, at('2026-11-06T09:00:00Z'), ctx()).window.age).toBe(32)
  })

  it('zählt unterwegs die eigenen Tage bis zum Beginn', () => {
    const jonas = { day: 7, month: 11, year: 1985, zone: null }
    // Sydney Fr 09:00: der deutsche Samstag beginnt dort Sa 10:00, also morgen
    expect(nextBirthday(jonas, at('2026-11-05T22:00:00Z'), ctx('Australia/Sydney')).days).toBe(1)
    // Los Angeles Do 15:01: der deutsche Samstag beginnt dort Fr 15:00, also morgen
    expect(nextBirthday(jonas, at('2026-11-05T23:01:00Z'), ctx('America/Los_Angeles')).days).toBe(1)
  })
})

describe('Erinnerungen', () => {
  it('am Tag 09:00 zu Hause', () => {
    expect(new Date(occurrence(lisa, day0900, 2026, ctx())).toISOString()).toBe('2026-11-06T08:00:00.000Z')
  })

  it('am Tag 09:00 in Sydney: 09:00 deutscher Zeit, dort 19:00', () => {
    const t = occurrence(lisa, day0900, 2026, ctx('Australia/Sydney'))
    expect(new Date(t).toISOString()).toBe('2026-11-06T08:00:00.000Z')
  })

  it('am Tag 09:00 in Los Angeles: dort wäre Mitternacht, deshalb 07:00 in Los Angeles', () => {
    const t = occurrence(lisa, day0900, 2026, ctx('America/Los_Angeles'))
    expect(new Date(t).toISOString()).toBe('2026-11-06T15:00:00.000Z') // 16:00 in Berlin
  })

  it('zu Hause bleibt eine frühe Uhrzeit, wie sie eingestellt ist', () => {
    expect(new Date(occurrence(lisa, { offset: { n: 0, unit: 'd' }, minute: 6 * 60 + 30 }, 2026, ctx())).toISOString()).toBe('2026-11-06T05:30:00.000Z')
  })

  it('vorab 3 Tage um 18:00 kommt zur eigenen Ortszeit', () => {
    const r = { offset: { n: 3, unit: 'd' as const }, minute: 18 * 60 }
    expect(new Date(occurrence(mehmet, r, 2026, ctx())).toISOString()).toBe('2026-11-11T17:00:00.000Z')
    expect(new Date(occurrence(mehmet, r, 2026, ctx('Australia/Sydney'))).toISOString()).toBe('2026-11-11T07:00:00.000Z')
  })

  it('findet die nächste Erinnerung nach einem Zeitpunkt', () => {
    const n = nextOccurrence(lisa, day0900, at('2026-11-06T09:00:00Z'), ctx())
    expect(new Date(n!.at).toISOString()).toBe('2027-11-06T08:00:00.000Z')
  })

  it('gibt vor dem Geburtsjahr keine Erinnerung', () => {
    const baby = { day: 1, month: 1, year: 2028, zone: null }
    const n = nextOccurrence(baby, day0900, at('2026-11-06T09:00:00Z'), ctx())
    expect(n).toBe(null)
  })
})

import { birthDate, dayFirstFor, longDate, shortDate, time } from './format'

describe('Datum als Text', () => {
  const de = { lang: 'de' as const, dayFirst: true, h24: true }
  const us = { lang: 'en' as const, dayFirst: false, h24: false }
  const au = { lang: 'en' as const, dayFirst: true, h24: true }
  const sat = { y: 2026, m: 11, d: 7 }

  it('Deutsch', () => {
    expect(shortDate(sat, de)).toBe('Sa, 7. Nov.')
    expect(longDate({ y: 2026, m: 11, d: 14 }, de)).toBe('Samstag, 14. November')
    expect(birthDate(14, 11, 1989, de)).toBe('14.11.1989')
    expect(time(540, de)).toBe('09:00')
  })

  it('Englisch USA: Monat vor Tag, 12 Stunden', () => {
    expect(shortDate(sat, us)).toBe('Sat, Nov 7')
    expect(longDate({ y: 2026, m: 11, d: 14 }, us)).toBe('Saturday, November 14')
    expect(birthDate(14, 11, 1989, us)).toBe('11/14/1989')
    expect(time(540, us)).toBe('9:00 AM')
    expect(time(0, us)).toBe('12:00 AM')
    expect(time(19 * 60 + 5, us)).toBe('7:05 PM')
  })

  it('Englisch Australien: Tag vor Monat', () => {
    expect(shortDate(sat, au)).toBe('Sat 7 Nov')
    expect(birthDate(14, 11, 1989, au)).toBe('14/11/1989')
    expect(time(540, au)).toBe('09:00')
  })

  it('erkennt die Region', () => {
    expect(dayFirstFor('en-US')).toBe(false)
    expect(dayFirstFor('en_US')).toBe(false)
    expect(dayFirstFor('en-AU')).toBe(true)
    expect(dayFirstFor('en-GB')).toBe(true)
    expect(dayFirstFor('en')).toBe(false)
    expect(dayFirstFor('de-DE')).toBe(false) // App auf Englisch, Handy auf Deutsch: wie USA
    expect(dayFirstFor('en-Latn-AU')).toBe(true)
    expect(dayFirstFor(null)).toBe(false)
  })
})

import { parseDateInput } from './dates'

describe('Eingabe des Datums in einem Feld', () => {
  const de = ['day', 'month', 'year'] as ('day' | 'month' | 'year')[]
  const us = ['month', 'day', 'year'] as ('day' | 'month' | 'year')[]
  it('verteilt Ziffern auf Tag, Monat, Jahr', () => {
    expect(parseDateInput('141189', de)).toEqual({ parts: ['14', '11', '89'], active: 2 })
    expect(parseDateInput('14111989', de).parts).toEqual(['14', '11', '1989'])
    expect(parseDateInput('1411', de)).toEqual({ parts: ['14', '11', ''], active: 2 })
  })
  it('springt bei einstelligen Teilen weiter', () => {
    expect(parseDateInput('53', de).parts).toEqual(['5', '3', ''])
    expect(parseDateInput('0111', de).parts).toEqual(['01', '11', ''])
  })
  it('kennt Trennzeichen', () => {
    expect(parseDateInput('1.1.89', de).parts).toEqual(['1', '1', '89'])
    expect(parseDateInput('1.', de)).toEqual({ parts: ['1', '', ''], active: 1 })
  })
  it('Englisch USA: Monat zuerst', () => {
    expect(parseDateInput('1114', us).parts).toEqual(['11', '14', ''])
    expect(parseDateInput('3/9', us).parts).toEqual(['3', '9', ''])
  })
})

import { dateFieldInput } from './dates'

describe('Eingabe in die Datumsfelder', () => {
  it('erste Ziffer ersetzt den alten Inhalt nach dem Antippen', () => {
    expect(dateFieldInput('year', '1989', '19891', true)).toEqual({ value: '1', next: false })
    expect(dateFieldInput('day', '07', '071', true)).toEqual({ value: '1', next: false })
    expect(dateFieldInput('day', '07', '107', true)).toEqual({ value: '1', next: false })
  })
  it('springt weiter, wenn ein Feld voll ist', () => {
    expect(dateFieldInput('day', '1', '14', false)).toEqual({ value: '14', next: true })
    expect(dateFieldInput('day', '', '5', false)).toEqual({ value: '5', next: true })
    expect(dateFieldInput('month', '', '1', false)).toEqual({ value: '1', next: false })
    expect(dateFieldInput('month', '', '3', false)).toEqual({ value: '3', next: true })
  })
  it('Jahr: Tastatur erst nach vier Ziffern schließen', () => {
    expect(dateFieldInput('year', '', '1', false)).toEqual({ value: '1', next: false })
    expect(dateFieldInput('year', '19', '197', false)).toEqual({ value: '197', next: false })
    expect(dateFieldInput('year', '197', '1975', false)).toEqual({ value: '1975', next: true })
  })
  it('Löschen nimmt die letzte Ziffer', () => {
    expect(dateFieldInput('year', '1975', '975', false)).toEqual({ value: '197', next: false })
    expect(dateFieldInput('day', '07', '0', true)).toEqual({ value: '0', next: false })
  })
  it('Trennzeichen springt weiter', () => {
    expect(dateFieldInput('day', '1', '1.', false)).toEqual({ value: '1', next: true })
    expect(dateFieldInput('day', '', '.', false)).toEqual({ value: '', next: false })
  })
})
