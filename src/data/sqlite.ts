import type { Person } from '../domain/model'
import type { Repository } from './repository'

/**
 * Die Teile von expo-sqlite, die der Speicher braucht. Als eigene Schnittstelle,
 * damit die Tests am PC eine andere SQLite-Anbindung einsetzen können.
 */
export interface SqlDatabase {
  execAsync(sql: string): Promise<void>
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>
  withTransactionAsync(task: () => Promise<void>): Promise<void>
}

/** Bei Änderungen am Aufbau erhöhen und in migrate() eine Umstellung ergänzen. */
const SCHEMA_VERSION = 1

/** Speicher in einer SQLite-Datenbank auf dem Handy. Je Eintrag eine Zeile mit dem Datensatz als JSON. */
export class SqliteRepository implements Repository {
  private ready: Promise<void>

  constructor(private readonly db: SqlDatabase) {
    this.ready = this.migrate()
  }

  private async migrate(): Promise<void> {
    await this.db.execAsync('PRAGMA journal_mode = WAL;')
    const row = await this.db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;')
    if ((row?.user_version ?? 0) < SCHEMA_VERSION) {
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY NOT NULL, updated INTEGER NOT NULL, doc TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
        PRAGMA user_version = ${SCHEMA_VERSION};`)
    }
  }

  async loadPeople() {
    await this.ready
    const rows = await this.db.getAllAsync<{ doc: string }>('SELECT doc FROM people')
    return rows.map((r) => JSON.parse(r.doc) as Person)
  }

  async putPeople(people: Person[]) {
    if (people.length === 0) return
    await this.ready
    await this.db.withTransactionAsync(async () => {
      for (const p of people) await this.db.runAsync('INSERT OR REPLACE INTO people (id, updated, doc) VALUES (?, ?, ?)', p.id, p.updated, JSON.stringify(p))
    })
  }

  async deletePeople(ids: string[]) {
    if (ids.length === 0) return
    await this.ready
    await this.db.withTransactionAsync(async () => {
      for (const id of ids) await this.db.runAsync('DELETE FROM people WHERE id = ?', id)
    })
  }

  async getMeta<T>(key: string) {
    await this.ready
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key)
    return row ? (JSON.parse(row.value) as T) : undefined
  }

  async setMeta<T>(key: string, value: T) {
    await this.ready
    await this.db.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, JSON.stringify(value))
  }

  async clear() {
    await this.ready
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM people')
      await this.db.runAsync('DELETE FROM meta')
    })
  }
}
