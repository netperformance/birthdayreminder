import type { Person } from '../domain/model'

/**
 * Schnittstelle zum Speicher. Auf dem Handy SQLite, in den Tests der Arbeitsspeicher.
 */
export interface Repository {
  loadPeople(): Promise<Person[]>
  putPeople(people: Person[]): Promise<void>
  deletePeople(ids: string[]): Promise<void>
  /** Kleine Werte: Einstellungen, Standard-Erinnerungen. */
  getMeta<T>(key: string): Promise<T | undefined>
  setMeta<T>(key: string, value: T): Promise<void>
  /** Löscht alle Einträge und Werte unwiderruflich. */
  clear(): Promise<void>
}
