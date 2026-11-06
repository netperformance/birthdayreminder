/**
 * Datenmodell von Birthdays.
 *
 * Ein Eintrag (Person) hat Name, Geburtstag (Tag, Monat, Jahr freiwillig), eine Notiz,
 * ein Bild und seine Erinnerungen. Die Erinnerungen kommen entweder aus dem Standard der
 * Einstellungen ("standard"), sind eigene ("custom") oder abgeschaltet ("none").
 */

import type { Lang } from './lang'

/** Einheit eines Abstands vor dem Geburtstag. */
export type OffsetUnit = 'd' | 'w' | 'm'

/** Abstand vor dem Geburtstag. n = 0 heißt "am Tag". */
export interface Offset {
  n: number
  unit: OffsetUnit
}

export interface Reminder {
  id: string
  offset: Offset
  /** Uhrzeit in Minuten nach Mitternacht (09:00 = 540). */
  minute: number
  popup: boolean
  /** Vollbild wie ein Wecker, auch über dem Sperrbildschirm. */
  fullscreen: boolean
  /** Kurzer eigener Hinweis, z. B. "Geschenk kaufen". */
  hint: string
}

export type ReminderMode = 'standard' | 'custom' | 'none'

export interface Person {
  id: string
  name: string
  day: number
  /** 1 bis 12. */
  month: number
  year: number | null
  note: string
  /** Dateiname des Bildes im Ordner der App, oder null. */
  photo: string | null
  /** Zeitzone der Person (IANA, z. B. "Australia/Sydney"). null: wie "Zuhause". */
  zone: string | null
  /**
   * Herkunft aus dem Adressbuch: Kennung des Kontakts und wie er beim letzten Import aussah.
   * Damit erkennt ein erneuter Import dieselbe Person und Änderungen im Adressbuch.
   * null bei Einträgen, die von Hand angelegt wurden.
   */
  contact: ContactLink | null
  /** Kennung der Gruppe (siehe Settings.groups). Jeder Eintrag hat eine, sonst NO_GROUP. */
  group: string
  mode: ReminderMode
  /** Eigene Erinnerungen, nur bei mode "custom" wirksam. */
  reminders: Reminder[]
  createdAt: number
  updated: number
}

/** Stand eines Kontakts beim letzten Import. */
export interface ContactLink {
  id: string
  name: string
  day: number
  month: number
  year: number | null
}

/**
 * Zwölf Farben für Gruppen, dieselben wie in My Notes. Gespeichert wird der Schlüssel,
 * damit sich ein Ton später anpassen lässt.
 */
export const GROUP_COLORS = {
  red: '#e5484d',
  orange: '#ef6c1a',
  amber: '#e0a100',
  lime: '#5aa832',
  green: '#1f9d5c',
  teal: '#12a594',
  blue: '#2f6fe4',
  indigo: '#3e63dd',
  violet: '#8e4ec6',
  pink: '#d6409f',
  brown: '#978365',
  gray: '#8b8d98',
} as const
export type ColorKey = keyof typeof GROUP_COLORS
export const COLOR_KEYS = Object.keys(GROUP_COLORS) as ColorKey[]
export const isColorKey = (v: unknown): v is ColorKey => typeof v === 'string' && v in GROUP_COLORS

/**
 * Gruppe wie Familie, Freunde oder Arbeit. Sie dient nur zum Ordnen und Filtern,
 * die Erinnerungen hängen nicht von der Gruppe ab. Jeder Eintrag gehört zu genau einer Gruppe.
 */
export interface Group {
  id: string
  name: string
  color: ColorKey
}

/**
 * Gruppen, die die App beim ersten Start anlegt, in der Sprache des Handys.
 * Danach gehören sie dem Nutzer: umbenennen, umfärben und löschen wie jede andere Gruppe.
 */
/**
 * Feste Gruppe "Ohne Gruppe". Sie ist immer da, steht nach der Installation an erster Stelle
 * und lässt sich weder umbenennen noch umfärben noch löschen, nur verschieben. Ihr Name kommt
 * aus der Sprache der App (gespeichert ist er leer). Wer keiner anderen Gruppe angehört,
 * gehört zu ihr: neue Einträge, Importe, Einträge gelöschter Gruppen.
 */
export const NO_GROUP = 'none'
export const noGroup = (): Group => ({ id: NO_GROUP, name: '', color: 'gray' })

export const STARTER_GROUPS: Record<Lang, { name: string; color: ColorKey }[]> = {
  de: [
    { name: 'Familie', color: 'red' },
    { name: 'Freunde', color: 'blue' },
    { name: 'Arbeit', color: 'teal' },
  ],
  en: [
    { name: 'Family', color: 'red' },
    { name: 'Friends', color: 'blue' },
    { name: 'Work', color: 'teal' },
  ],
}

export type LockScreen = 'all' | 'name' | 'none'

/** Was am 29. Februar in Jahren ohne Schalttag gilt. */
export type Feb29 = 'feb28' | 'mar1'

export interface Settings {
  /** Hauptschalter "Alle Erinnerungen". */
  enabled: boolean
  /** Standard für alle Einträge. */
  defaults: Reminder[]
  lockScreen: LockScreen
  feb29: Feb29
  /** Zeitzone "Zuhause". Geburtstage beginnen um 00:00 in dieser Zone. */
  homeZone: string
  /** Eigene Abstände, die als zusätzliche Chips zur Auswahl stehen. */
  customOffsets: Offset[]
  /** Hinweis "Erinnerungen pausiert" für die laufende Pause geschlossen. */
  pauseBannerClosed: boolean
  /** Gruppen in der Reihenfolge der Chips auf der Startseite. */
  groups: Group[]
}

export const MINUTE_0900 = 9 * 60
export const MINUTE_1800 = 18 * 60

export const sameOffset = (a: Offset, b: Offset) => offsetKey(a) === offsetKey(b)

/** Ungefähre Tage, nur zum Sortieren und Vergleichen (ein Monat zählt 30 Tage). */
export function toDaysApprox(o: Offset): number {
  return o.unit === 'd' ? o.n : o.unit === 'w' ? o.n * 7 : o.n * 30
}

/** Feste Abstände, die immer als Chips da sind. */
export const PRESET_OFFSETS: Offset[] = [
  { n: 0, unit: 'd' },
  { n: 1, unit: 'd' },
  { n: 3, unit: 'd' },
  { n: 1, unit: 'w' },
  { n: 2, unit: 'w' },
]

export const offsetKey = (o: Offset) => (o.n === 0 ? '0' : `${o.n}${o.unit}`)

export const isOffset = (v: unknown): v is Offset =>
  !!v && typeof v === 'object' && Number.isInteger((v as Offset).n) && (v as Offset).n >= 0 && ['d', 'w', 'm'].includes((v as Offset).unit)

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
}

export function defaultReminders(): Reminder[] {
  return [
    { id: 'std-day', offset: { n: 0, unit: 'd' }, minute: MINUTE_0900, popup: true, fullscreen: false, hint: '' },
    { id: 'std-3d', offset: { n: 3, unit: 'd' }, minute: MINUTE_1800, popup: true, fullscreen: false, hint: '' },
  ]
}

/** Erinnerungen sortiert: weit vorher zuerst, "am Tag" zuletzt, dann nach Uhrzeit. */
export function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => toDaysApprox(b.offset) - toDaysApprox(a.offset) || a.minute - b.minute)
}

/** Die Erinnerungen, die für diesen Eintrag tatsächlich gelten. */
export function effectiveReminders(p: Person, settings: Settings): Reminder[] {
  if (p.mode === 'none') return []
  return sortReminders(p.mode === 'custom' ? p.reminders : settings.defaults)
}
