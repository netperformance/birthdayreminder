import { describe, expect, it } from 'vitest'
import { MemoryRepository } from '../data/memory'
import type { Repository } from '../data/repository'
import { SqliteRepository } from '../data/sqlite'
import { nodeSqlite } from '../data/sqlite.node-test'
import { NO_GROUP, noGroup, STARTER_GROUPS } from '../domain/model'
import { BackupError, BirthdayStore, type PhotoFiles } from './store'

let t = 1_800_000_000_000
const now = () => (t += 1000)
const open = (repo: Repository = new MemoryRepository()) => BirthdayStore.open(repo, { now, deviceZone: 'Europe/Berlin' })

class MemoryPhotos implements PhotoFiles {
  files = new Map<string, string>()
  n = 0
  async read(name: string) {
    return this.files.get(name) ?? null
  }
  async write(b64: string) {
    const name = `p${++this.n}.jpg`
    this.files.set(name, b64)
    return name
  }
  async remove(name: string) {
    this.files.delete(name)
  }
}

describe('Einträge', () => {
  it('legt an, ändert und sortiert nach Namen', async () => {
    const s = await open()
    s.create({ name: 'Mehmet Yilmaz', day: 14, month: 11, year: 1989 })
    const lisa = s.create({ name: '  Lisa Bergmann ', day: 6, month: 11, year: null })
    expect(s.getSnapshot().people.map((p) => p.name)).toEqual(['Lisa Bergmann', 'Mehmet Yilmaz'])
    s.update(lisa.id, { note: 'Mag Pralinen' })
    expect(s.get(lisa.id)?.note).toBe('Mag Pralinen')
    expect(s.get(lisa.id)?.mode).toBe('standard')
  })

  it('lehnt ungültige Daten ab', async () => {
    const s = await open()
    expect(() => s.create({ name: 'X', day: 31, month: 4, year: null })).toThrow()
    expect(() => s.create({ name: ' ', day: 1, month: 1, year: null })).toThrow()
  })

  it('löscht mit Rückgängig', async () => {
    const repo = new MemoryRepository()
    const s = await open(repo)
    const p = s.create({ name: 'Anna', day: 3, month: 12, year: 1990 })
    s.remove([p.id])
    expect(s.getSnapshot().people).toHaveLength(0)
    s.restore([p.id])
    expect(s.getSnapshot().people).toHaveLength(1)
    await s.flush()
    expect(await repo.loadPeople()).toHaveLength(1)
  })

  it('kopiert beim Wechsel auf Eigene den Standard', async () => {
    const s = await open()
    const p = s.create({ name: 'Anna', day: 3, month: 12, year: 1990 })
    s.setReminders(p.id, 'custom')
    expect(s.get(p.id)?.reminders).toHaveLength(2)
    expect(s.get(p.id)?.reminders[0].id).not.toBe(s.getSnapshot().settings.defaults[0].id)
  })

  it('übernimmt Kontakte ohne Doppelte', async () => {
    const s = await open()
    s.create({ name: 'Mehmet Yilmaz', day: 14, month: 11, year: 1989 })
    const r = s.applyContactImport({
      add: [
        { id: 'a', name: 'mehmet yilmaz', day: 14, month: 11, year: null },
        { id: 'b', name: 'Peter Hahn', day: 9, month: 8, year: 1964 },
        { id: 'c', name: 'Peter Hahn', day: 9, month: 8, year: 1964 },
      ],
      update: [],
      link: [],
    })
    expect(r.added).toBe(1)
    expect(s.getSnapshot().people).toHaveLength(2)
  })
})

describe('Einstellungen', () => {
  it('startet mit zwei Popup-Erinnerungen und der Zone des Handys', async () => {
    const s = await open()
    const st = s.getSnapshot().settings
    expect(st.defaults.map((r) => [r.offset.n, r.minute, r.popup, r.fullscreen])).toEqual([
      [0, 540, true, false],
      [3, 1080, true, false],
    ])
    expect(st.homeZone).toBe('Europe/Berlin')
    expect(st.enabled).toBe(true)
  })

  it('zeigt den Hinweis zur Pause nach erneutem Pausieren wieder', async () => {
    const s = await open()
    s.setSettings({ enabled: false })
    s.setSettings({ pauseBannerClosed: true })
    s.setSettings({ enabled: true })
    s.setSettings({ enabled: false })
    expect(s.getSnapshot().settings.pauseBannerClosed).toBe(false)
  })

  it('merkt sich eigene Abstände ohne Doppelte', async () => {
    const s = await open()
    s.addCustomOffset({ n: 6, unit: 'd' })
    s.addCustomOffset({ n: 6, unit: 'd' })
    expect(s.getSnapshot().settings.customOffsets).toEqual([{ n: 6, unit: 'd' }])
  })
})

describe('Gruppen', () => {
  it('legt an, benennt um, sortiert und verhindert doppelte Namen', async () => {
    const s = await open()
    const fam = s.createGroup(' Familie ', 'red')!
    const work = s.createGroup('Arbeit', 'teal')!
    expect(s.createGroup('familie', 'blue')).toBeNull()
    expect(s.createGroup('  ', 'blue')).toBeNull()
    s.updateGroup(work.id, { name: 'FAMILIE' })
    expect(s.group(work.id)?.name).toBe('Arbeit')
    s.updateGroup(work.id, { name: 'Büro', color: 'blue' })
    expect(s.group(work.id)).toEqual({ id: work.id, name: 'Büro', color: 'blue' })
    s.setGroupOrder([work.id, fam.id])
    expect(s.getSnapshot().settings.groups.map((g) => g.name)).toEqual(['Büro', 'Familie', ''])
  })

  it('ordnet zu und ignoriert unbekannte Gruppen', async () => {
    const s = await open()
    const fam = s.createGroup('Familie', 'red')!
    const a = s.create({ name: 'Anna', day: 3, month: 12, year: 1990, group: fam.id })
    const b = s.create({ name: 'Ben', day: 4, month: 12, year: null, group: 'gibt-es-nicht' })
    expect(s.get(a.id)?.group).toBe(fam.id)
    expect(s.get(b.id)?.group).toBe(NO_GROUP)
    s.setGroup(b.id, fam.id)
    expect(s.get(b.id)?.group).toBe(fam.id)
    s.setGroup(b.id, null)
    expect(s.get(b.id)?.group).toBe(NO_GROUP)
  })

  it('löscht eine Gruppe ohne Einträge zu löschen, mit Rückgängig', async () => {
    const s = await open()
    s.createGroup('Freunde', 'blue')
    const fam = s.createGroup('Familie', 'red')!
    const a = s.create({ name: 'Anna', day: 3, month: 12, year: 1990, group: fam.id, mode: 'none' })
    const undo = s.removeGroup(fam.id)!
    expect(s.getSnapshot().people).toHaveLength(1)
    expect(s.get(a.id)?.group).toBe(NO_GROUP)
    expect(s.get(a.id)?.mode).toBe('none')
    expect(s.getSnapshot().settings.groups.map((g) => g.name)).toEqual(['', 'Freunde'])
    s.restoreGroup(undo)
    expect(s.getSnapshot().settings.groups.map((g) => g.name)).toEqual(['', 'Freunde', 'Familie'])
    expect(s.get(a.id)?.group).toBe(fam.id)
  })

  it('gibt neuen Einträgen aus den Kontakten die gewählte Gruppe', async () => {
    const s = await open()
    const fam = s.createGroup('Familie', 'red')!
    s.applyContactImport({ add: [{ id: 'a', name: 'Peter Hahn', day: 9, month: 8, year: 1964 }], group: fam.id, update: [], link: [] })
    expect(s.getSnapshot().people[0].group).toBe(fam.id)
  })

  it('bleibt nach dem Neustart und in der Sicherung erhalten', async () => {
    const repo = new MemoryRepository()
    const s = await open(repo)
    const fam = s.createGroup('Familie', 'red')!
    s.create({ name: 'Anna', day: 3, month: 12, year: 1990, group: fam.id })
    await s.flush()
    const again = await open(repo)
    expect(again.getSnapshot().settings.groups).toEqual([noGroup(), fam])
    expect(again.getSnapshot().people[0].group).toBe(fam.id)
    const backup = JSON.parse(JSON.stringify(await again.exportBackup(new MemoryPhotos())))
    const other = await open()
    await other.importBackup(backup, new MemoryPhotos())
    expect(other.getSnapshot().settings.groups).toEqual([noGroup(), fam])
    expect(other.getSnapshot().people[0].group).toBe(fam.id)
  })
})

describe('Sicherung', () => {
  it('speichert und lädt mit Bildern', async () => {
    const photos = new MemoryPhotos()
    const a = await open()
    const name = await photos.write('AAAA')
    a.create({ name: 'Anna', day: 3, month: 12, year: 1990, photo: name, note: 'Tulpen' })
    const backup = JSON.parse(JSON.stringify(await a.exportBackup(photos)))
    const b = await open()
    const target = new MemoryPhotos()
    expect(await b.importBackup(backup, target)).toBe(1)
    const p = b.getSnapshot().people[0]
    expect(p.note).toBe('Tulpen')
    expect(await target.read(p.photo!)).toBe('AAAA')
  })

  it('erkennt fremde Dateien', async () => {
    const s = await open()
    await expect(s.importBackup({ app: 'mynotes', format: 1 }, new MemoryPhotos())).rejects.toBeInstanceOf(BackupError)
  })

  it('löscht alles außer den genannten Werten', async () => {
    const repo = new MemoryRepository()
    const s = await open(repo)
    await repo.setMeta('pref:theme', 'dark')
    s.create({ name: 'Anna', day: 3, month: 12, year: 1990 })
    await s.reset({ keepMeta: ['pref:theme'] })
    expect(s.getSnapshot().people).toHaveLength(0)
    expect(await repo.getMeta('pref:theme')).toBe('dark')
  })
})

describe('SQLite', () => {
  it('speichert dauerhaft', async () => {
    const db = nodeSqlite(':memory:')
    const s = await open(new SqliteRepository(db))
    s.create({ name: 'Anna', day: 3, month: 12, year: 1990 })
    await s.flush()
    const again = await open(new SqliteRepository(db))
    expect(again.getSnapshot().people.map((p) => p.name)).toEqual(['Anna'])
  })
})

describe('Start-Gruppen', () => {
  const openWith = (repo: Repository, lang: 'de' | 'en' = 'de') =>
    BirthdayStore.open(repo, { now, deviceZone: 'Europe/Berlin', starterGroups: STARTER_GROUPS[lang] })
  const names = (s: BirthdayStore) => s.getSnapshot().settings.groups.map((g) => g.name)

  it('legt beim ersten Start Familie, Freunde und Arbeit an', async () => {
    const s = await openWith(new MemoryRepository())
    expect(s.getSnapshot().settings.groups.map((g) => [g.name, g.color])).toEqual([
      ['', 'gray'],
      ['Familie', 'red'],
      ['Freunde', 'blue'],
      ['Arbeit', 'teal'],
    ])
  })

  it('nimmt auf englischen Handys die englischen Namen', async () => {
    expect(names(await openWith(new MemoryRepository(), 'en'))).toEqual(['', 'Family', 'Friends', 'Work'])
  })

  it('legt nichts doppelt an und bringt gelöschte Gruppen nicht zurück', async () => {
    const repo = new MemoryRepository()
    const s = await openWith(repo)
    s.removeGroup(s.findGroupByName('Arbeit')!.id)
    await s.flush()
    expect(names(await openWith(repo))).toEqual(['', 'Familie', 'Freunde'])
  })

  it('ergänzt beim Update nur, was fehlt', async () => {
    const repo = new MemoryRepository()
    const old = await open(repo)
    old.createGroup('Sport', 'green')
    old.createGroup('familie', 'pink')
    await old.flush()
    expect(names(await openWith(repo))).toEqual(['', 'Sport', 'familie', 'Freunde', 'Arbeit'])
  })

  it('legt sie nach "Alle Daten löschen" neu an', async () => {
    const repo = new MemoryRepository()
    const s = await openWith(repo)
    s.removeGroup(s.findGroupByName('Familie')!.id)
    await s.reset()
    expect(names(s)).toEqual(['', 'Familie', 'Freunde', 'Arbeit'])
    expect(names(await openWith(repo))).toEqual(['', 'Familie', 'Freunde', 'Arbeit'])
  })
})

describe('Ohne Gruppe', () => {
  it('ist fest: nicht umbenennen, nicht umfärben, nicht löschen, Name vergeben', async () => {
    const s = await open()
    s.updateGroup(NO_GROUP, { name: 'Sonstige', color: 'red' })
    expect(s.group(NO_GROUP)).toEqual(noGroup())
    expect(s.removeGroup(NO_GROUP)).toBeNull()
    expect(s.createGroup('ohne gruppe', 'red')).toBeNull()
    expect(s.createGroup('No Group', 'red')).toBeNull()
    expect(s.getSnapshot().settings.groups).toEqual([noGroup()])
  })

  it('lässt sich verschieben', async () => {
    const s = await open()
    const fam = s.createGroup('Familie', 'red')!
    s.setGroupOrder([fam.id, NO_GROUP])
    expect(s.getSnapshot().settings.groups.map((g) => g.id)).toEqual([fam.id, NO_GROUP])
  })

  it('nimmt neue Einträge und Importe ohne gewählte Gruppe auf', async () => {
    const s = await open()
    s.createGroup('Familie', 'red')
    const a = s.create({ name: 'Anna', day: 3, month: 12, year: 1990 })
    s.applyContactImport({ add: [{ id: 'k', name: 'Peter Hahn', day: 9, month: 8, year: 1964 }], update: [], link: [] })
    expect(s.get(a.id)?.group).toBe(NO_GROUP)
    expect(s.getSnapshot().people.every((p) => p.group === NO_GROUP)).toBe(true)
  })

  it('übernimmt beim Update Einträge ohne Gruppe und mit unbekannter Gruppe', async () => {
    const repo = new MemoryRepository()
    await repo.setMeta('settings', { groups: [{ id: 'fam', name: 'Familie', color: 'red' }] })
    await repo.putPeople([
      { id: 'a', name: 'Anna', day: 3, month: 12, year: 1990, group: null } as never,
      { id: 'b', name: 'Ben', day: 4, month: 12, year: null, group: 'weg' } as never,
      { id: 'c', name: 'Cem', day: 5, month: 12, year: null, group: 'fam' } as never,
    ])
    const s = await open(repo)
    expect(s.getSnapshot().settings.groups.map((g) => g.id)).toEqual([NO_GROUP, 'fam'])
    expect(s.get('a')?.group).toBe(NO_GROUP)
    expect(s.get('b')?.group).toBe(NO_GROUP)
    expect(s.get('c')?.group).toBe('fam')
  })

  it('übernimmt alte Sicherungen ohne "Ohne Gruppe"', async () => {
    const s = await open()
    await s.importBackup(
      {
        app: 'birthdays',
        format: 1,
        exportedAt: '',
        people: [
          { id: 'a', name: 'Anna', day: 3, month: 12, year: 1990, group: null },
          { id: 'b', name: 'Ben', day: 4, month: 12, year: null, group: 'fam' },
        ],
        settings: { groups: [{ id: 'fam', name: 'Familie', color: 'red' }] },
      },
      new MemoryPhotos(),
    )
    expect(s.getSnapshot().settings.groups.map((g) => g.id)).toEqual([NO_GROUP, 'fam'])
    expect(s.get('a')?.group).toBe(NO_GROUP)
    expect(s.get('b')?.group).toBe('fam')
  })
})
