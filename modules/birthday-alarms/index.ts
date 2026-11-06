import { requireOptionalNativeModule, type EventSubscription } from 'expo'
import { intlZoneInfo } from '../../src/domain/zone'

/** Was die App dem Modul schickt. Das Modul plant daraus alle Erinnerungen selbst. */
export interface AlarmPayload {
  enabled: boolean
  lang: 'de' | 'en'
  dayFirst: boolean
  homeZone: string
  feb29: 'feb28' | 'mar1'
  lockScreen: 'all' | 'name' | 'none'
  people: {
    id: string
    name: string
    day: number
    month: number
    year: number | null
    zone: string | null
    note: string
    /** Sternzeichen mit Symbol in der Sprache der App, z. B. "♏︎ Skorpion". */
    sign: string
    /** Pfad zum Bild (file://…) oder leer. */
    photo: string
    reminders: { n: number; unit: 'd' | 'w' | 'm'; minute: number; popup: boolean; fullscreen: boolean; hint: string }[]
  }[]
}

export interface Permissions {
  notifications: boolean
  exact: boolean
  fullscreen: boolean
  battery: boolean
}

export type SettingsPage = 'notifications' | 'exact' | 'fullscreen' | 'battery' | 'app'

/** Person mit Datum des Geburtstags und Uhrzeit, zu der "Beenden" getippt wurde. */
export type DoneMap = Record<string, { date: string; at: number }>

type Native = {
  sync(json: string): void
  getDone(): string
  markDone(personId: string, date: string): void
  currentZone(): string
  offsetMinutes(zone: string, epochMs: number): number
  zones(): string[]
  is24Hour(): boolean
  locale(): string
  permissions(): Permissions
  openSettings(kind: SettingsPage): Promise<boolean>
  launchPerson(): string | null
  addListener(event: 'onOpenPerson', listener: (e: { id: string }) => void): EventSubscription
}

const native = requireOptionalNativeModule<Native>('BirthdayAlarms')

/** Ohne das Modul (Tests, Expo Go) bleibt "Beenden" nur im Arbeitsspeicher. */
const localDone: DoneMap = {}

export const alarms = {
  available: !!native,
  sync(payload: AlarmPayload): void {
    try {
      native?.sync(JSON.stringify(payload))
    } catch (e) {
      console.error('Erinnerungen nicht geplant', e)
    }
  },
  done(): DoneMap {
    if (!native) return { ...localDone }
    try {
      return JSON.parse(native.getDone()) as DoneMap
    } catch {
      return {}
    }
  },
  markDone(personId: string, date: string): void {
    if (native) native.markDone(personId, date)
    else localDone[personId] = { date, at: Date.now() }
  },
  currentZone(): string {
    try {
      return native?.currentZone() ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'Europe/Berlin'
    } catch {
      return 'Europe/Berlin'
    }
  },
  zoneInfo: {
    offsetMinutes(zone: string, epochMs: number): number {
      return native ? native.offsetMinutes(zone, epochMs) : intlZoneInfo.offsetMinutes(zone, epochMs)
    },
  },
  zones(): string[] {
    try {
      return native?.zones() ?? (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
    } catch {
      return []
    }
  },
  is24Hour(): boolean {
    try {
      return native?.is24Hour() ?? true
    } catch {
      return true
    }
  },
  locale(): string | null {
    try {
      return native?.locale() ?? null
    } catch {
      return null
    }
  },
  permissions(): Permissions {
    try {
      return native?.permissions() ?? { notifications: true, exact: true, fullscreen: true, battery: true }
    } catch {
      return { notifications: true, exact: true, fullscreen: true, battery: true }
    }
  },
  openSettings(kind: SettingsPage): Promise<boolean> {
    return native ? native.openSettings(kind).catch(() => false) : Promise.resolve(false)
  },
  launchPerson(): string | null {
    try {
      return native?.launchPerson() ?? null
    } catch {
      return null
    }
  },
  onOpenPerson(listener: (id: string) => void): () => void {
    if (!native) return () => {}
    const sub = native.addListener('onOpenPerson', (e) => listener(e.id))
    return () => sub.remove()
  },
}
