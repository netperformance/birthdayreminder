import type { ContactLink, Person } from '../domain/model'
import { sameBirthday } from './store'

/**
 * Was ein erneuter Import aus den Kontakten mit jedem Kontakt tun würde.
 *
 * Erkannt wird eine Person zuerst an der Kennung des Kontakts, die beim Import gespeichert
 * wurde, und erst danach an Name und Geburtstag. Die Kennung allein reicht nicht: Android
 * vergibt sie neu, wenn Kontakte zusammengeführt werden oder das Konto neu eingerichtet wird.
 *
 * - "new": noch nicht in der App
 * - "changed": im Adressbuch seit dem letzten Import geändert (Name oder Datum). Was nur in der
 *   App geändert wurde, zählt nicht als Änderung, damit eigene Korrekturen bleiben.
 * - "same": schon vorhanden, nichts zu tun (außer die Kennung zu merken)
 */
export type PlanItem =
  | { kind: 'new'; contact: ContactLink }
  | { kind: 'changed'; contact: ContactLink; person: Person; name: boolean; date: boolean }
  | { kind: 'same'; contact: ContactLink; person: Person }

const sameDate = (a: Pick<ContactLink, 'day' | 'month' | 'year'>, b: Pick<ContactLink, 'day' | 'month' | 'year'>) =>
  a.day === b.day && a.month === b.month && a.year === b.year

export function planContactImport(people: Person[], found: ContactLink[]): PlanItem[] {
  const used = new Set<string>()
  const out: PlanItem[] = []
  for (const c of found) {
    const byId = people.find((p) => !used.has(p.id) && p.contact?.id === c.id)
    const match = byId ?? people.find((p) => !used.has(p.id) && sameBirthday(p, c))
    if (!match) {
      out.push({ kind: 'new', contact: c })
      continue
    }
    used.add(match.id)
    const before = match.contact
    if (byId && before) {
      const name = c.name !== before.name && c.name !== match.name
      const date = !sameDate(c, before) && !sameDate(c, match)
      if (name || date) {
        out.push({ kind: 'changed', contact: c, person: match, name, date })
        continue
      }
    }
    out.push({ kind: 'same', contact: c, person: match })
  }
  return out
}
