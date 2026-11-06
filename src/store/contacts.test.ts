import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../data/memory'
import type { ContactLink } from '../domain/model'
import { planContactImport } from './contacts'
import { BirthdayStore } from './store'

let t = 1_800_000_000_000
const open = () => BirthdayStore.open(new MemoryRepository(), { now: () => (t += 1000), deviceZone: 'Europe/Berlin' })
const lisa: ContactLink = { id: 'c1', name: 'Lisa Bergmann', day: 6, month: 11, year: 1992 }
const peter: ContactLink = { id: 'c2', name: 'Peter Hahn', day: 9, month: 8, year: 1964 }

describe('Import aus den Kontakten', () => {
  it('legt beim ersten Mal an und erkennt beim zweiten Mal alle wieder', async () => {
    const s = await open()
    const first = planContactImport(s.getSnapshot().people, [lisa, peter])
    expect(first.map((x) => x.kind)).toEqual(['new', 'new'])
    s.applyContactImport({ add: [lisa, peter], update: [], link: [] })
    const second = planContactImport(s.getSnapshot().people, [lisa, peter])
    expect(second.map((x) => x.kind)).toEqual(['same', 'same'])
  })

  it('erkennt eine Person an der Kennung, auch wenn sie in der App umbenannt wurde', async () => {
    const s = await open()
    s.applyContactImport({ add: [lisa], update: [], link: [] })
    const p = s.getSnapshot().people[0]
    s.update(p.id, { name: 'Lisi' })
    expect(planContactImport(s.getSnapshot().people, [lisa]).map((x) => x.kind)).toEqual(['same'])
  })

  it('meldet ein im Adressbuch korrigiertes Datum und übernimmt nur das Datum', async () => {
    const s = await open()
    s.applyContactImport({ add: [lisa], update: [], link: [] })
    const p = s.getSnapshot().people[0]
    s.update(p.id, { name: 'Lisi' })
    const fixed = { ...lisa, day: 7 }
    const plan = planContactImport(s.getSnapshot().people, [fixed])
    expect(plan[0]).toMatchObject({ kind: 'changed', date: true, name: false })
    s.applyContactImport({ add: [], update: [{ id: p.id, contact: fixed, name: false, date: true }], link: [] })
    expect(s.get(p.id)).toMatchObject({ name: 'Lisi', day: 7 })
    expect(planContactImport(s.getSnapshot().people, [fixed]).map((x) => x.kind)).toEqual(['same'])
  })

  it('meldet einen im Adressbuch geänderten Namen', async () => {
    const s = await open()
    s.applyContactImport({ add: [lisa], update: [], link: [] })
    const plan = planContactImport(s.getSnapshot().people, [{ ...lisa, name: 'Lisa Schulz' }])
    expect(plan[0]).toMatchObject({ kind: 'changed', name: true, date: false })
  })

  it('verknüpft von Hand angelegte Einträge über Name und Datum', async () => {
    const s = await open()
    const p = s.create({ name: 'Peter Hahn', day: 9, month: 8, year: 1964 })
    const plan = planContactImport(s.getSnapshot().people, [peter])
    expect(plan[0]).toMatchObject({ kind: 'same' })
    s.applyContactImport({ add: [], update: [], link: [{ id: p.id, contact: peter }] })
    expect(s.get(p.id)?.contact?.id).toBe('c2')
  })

  it('neue Kennung nach Kontowechsel: gleiche Person über Name und Datum, keine Doppelten', async () => {
    const s = await open()
    s.applyContactImport({ add: [lisa], update: [], link: [] })
    const plan = planContactImport(s.getSnapshot().people, [{ ...lisa, id: 'neu' }])
    expect(plan.map((x) => x.kind)).toEqual(['same'])
    expect(s.applyContactImport({ add: [{ ...lisa, id: 'neu' }], update: [], link: [] }).added).toBe(0)
  })
})
