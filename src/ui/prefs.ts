import type { Repository } from '../data/repository'
import { isLang, type Lang } from '../domain/lang'
import type { ThemeMode } from './theme'

/** Einstellungen der Oberfläche. Sie liegen in der Datenbank des Handys (Tabelle meta). */
export interface Prefs {
  theme: ThemeMode
  language: Lang
  /** Stufe der Schriftgröße, Index in FONT_STEPS. */
  fontStep: number
}

export const FONT_STEPS = [0.85, 1, 1.15, 1.3, 1.5]

/** Ohne gespeicherte Wahl startet die App hell. Die Sprache folgt dem Handy. */
export const DEFAULT_PREFS: Prefs = { theme: 'light', language: 'de', fontStep: 1 }

const key = (name: keyof Prefs) => `pref:${name}`

/** Diese Werte bleiben auch bei "Alle Daten löschen" erhalten. */
export const PREF_KEYS = (Object.keys(DEFAULT_PREFS) as (keyof Prefs)[]).map(key)

export async function loadPrefs(repo: Repository, deviceLanguage: Lang): Promise<Prefs> {
  const prefs = { ...DEFAULT_PREFS, language: deviceLanguage }
  try {
    const theme = await repo.getMeta<ThemeMode>(key('theme'))
    if (theme === 'system' || theme === 'light' || theme === 'dark') prefs.theme = theme
    const language = await repo.getMeta<Lang>(key('language'))
    if (isLang(language)) prefs.language = language
    const fontStep = await repo.getMeta<number>(key('fontStep'))
    if (typeof fontStep === 'number' && fontStep >= 0 && fontStep < FONT_STEPS.length) prefs.fontStep = Math.round(fontStep)
  } catch (error) {
    console.error('Einstellungen nicht lesbar', error)
  }
  return prefs
}

export function savePref<K extends keyof Prefs>(repo: Repository, name: K, value: Prefs[K]): Promise<void> {
  return repo.setMeta(key(name), value).catch((error) => console.error('Einstellung nicht gespeichert', error))
}
