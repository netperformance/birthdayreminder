import type { Person } from '../domain/model'
import type { Repository } from './repository'

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** Speicher im Arbeitsspeicher, für Tests. */
export class MemoryRepository implements Repository {
  private people = new Map<string, Person>()
  private meta = new Map<string, unknown>()

  async loadPeople() {
    return [...this.people.values()].map(clone)
  }

  async putPeople(people: Person[]) {
    for (const p of people) this.people.set(p.id, clone(p))
  }

  async deletePeople(ids: string[]) {
    for (const id of ids) this.people.delete(id)
  }

  async getMeta<T>(key: string) {
    const v = this.meta.get(key)
    return v === undefined ? undefined : clone(v as T)
  }

  async setMeta<T>(key: string, value: T) {
    this.meta.set(key, clone(value))
  }

  async clear() {
    this.people.clear()
    this.meta.clear()
  }
}
