import type { AlarmPayload } from '../../modules/birthday-alarms'
import type { Lang } from '../domain/lang'
import { effectiveReminders, type Person, type Settings } from '../domain/model'
import { signLabel } from './labels'
import { photoUri } from './photos'

/** Alles, was das Erinnerungsmodul zum Planen braucht, in der Sprache der App. */
export function buildPayload(people: Person[], settings: Settings, lang: Lang, dayFirst: boolean): AlarmPayload {
  return {
    enabled: settings.enabled,
    lang,
    dayFirst,
    homeZone: settings.homeZone,
    feb29: settings.feb29,
    lockScreen: settings.lockScreen,
    people: people.map((p) => ({
      id: p.id,
      name: p.name,
      day: p.day,
      month: p.month,
      year: p.year,
      zone: p.zone,
      note: p.note.trim(),
      sign: signLabel(p.month, p.day, lang).full,
      photo: photoUri(p.photo) ?? '',
      reminders: effectiveReminders(p, settings)
        .filter((r) => r.popup || r.fullscreen)
        .map((r) => ({ n: r.offset.n, unit: r.offset.unit, minute: r.minute, popup: r.popup, fullscreen: r.fullscreen, hint: r.hint })),
    })),
  }
}
