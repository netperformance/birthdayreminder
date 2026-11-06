import type { Repository } from '../data/repository'
import { isValidBirthday } from '../domain/dates'
import {
  defaultReminders,
  isColorKey,
  isOffset,
  newId,
  noGroup,
  NO_GROUP,
  offsetKey,
  type ContactLink,
  type ColorKey,
  type Feb29,
  type Group,
  type LockScreen,
  type Offset,
  type Person,
  type Reminder,
  type ReminderMode,
  type Settings,
} from '../domain/model'
import { normalize } from '../domain/normalize'

/** Was die Oberfläche anzeigt. Wird bei jeder Änderung neu erzeugt (unveränderlich). */
export interface Snapshot {
  people: Person[]
  settings: Settings
}

export interface PersonInput {
  name: string
  day: number
  month: number
  year: number | null
  note?: string
  zone?: string | null
  mode?: ReminderMode
  reminders?: Reminder[]
  photo?: string | null
  group?: string | null
}

/** Ablage der Bilder. Auf dem Handy Dateien im Ordner der App, in den Tests der Arbeitsspeicher. */
export interface PhotoFiles {
  /** Inhalt als Base64, oder null, wenn die Datei fehlt. */
  read(name: string): Promise<string | null>
  /** Legt eine neue Datei an und gibt ihren Namen zurück. */
  write(base64: string): Promise<string>
  remove(name: string): Promise<void>
}

/** Fehler beim Einspielen einer Sicherung. Die Oberfläche zeigt die Meldung in der gewählten Sprache. */
export class BackupError extends Error {
  constructor(readonly code: 'not-a-backup' | 'damaged') {
    super(code)
    this.name = 'BackupError'
  }
}

export interface Backup {
  app: 'birthdays'
  format: 1
  exportedAt: string
  people: (Person & { photoData?: string | null })[]
  settings: Omit<Settings, 'pauseBannerClosed'>
}

type Listener = () => void

const SETTINGS_KEY = 'settings'
/** Merker, dass die Start-Gruppen angelegt wurden. Danach kommen gelöschte nicht wieder. */
const STARTER_KEY = 'starterGroups'

export type StarterGroup = { name: string; color: ColorKey }

export function defaultSettings(homeZone: string): Settings {
  return {
    enabled: true,
    defaults: defaultReminders(),
    lockScreen: 'all',
    feb29: 'feb28',
    homeZone,
    customOffsets: [],
    pauseBannerClosed: false,
    groups: [noGroup()],
  }
}

const GROUP_NAME_MAX = 30
/** Namen der festen Gruppe in allen Sprachen der App. Keine andere Gruppe darf so heißen. */
const NO_GROUP_NAMES = ['Ohne Gruppe', 'No group']

/** Prüft die Gruppen. "Ohne Gruppe" ist immer dabei, fehlt sie (ältere Version), kommt sie an die erste Stelle. */
function cleanGroups(list: unknown): Group[] {
  const out: Group[] = []
  for (const raw of (Array.isArray(list) ? list : []) as Partial<Group>[]) {
    if (raw && raw.id === NO_GROUP) {
      if (!out.some((g) => g.id === NO_GROUP)) out.push(noGroup())
      continue
    }
    if (!raw || typeof raw.id !== 'string' || !raw.id || typeof raw.name !== 'string') continue
    const name = raw.name.trim().slice(0, GROUP_NAME_MAX)
    if (!name || out.some((g) => g.id === raw.id || normalize(g.name) === normalize(name))) continue
    out.push({ id: raw.id, name, color: isColorKey(raw.color) ? raw.color : 'blue' })
  }
  if (!out.some((g) => g.id === NO_GROUP)) out.unshift(noGroup())
  return out
}

function cleanReminder(r: Partial<Reminder>): Reminder | null {
  if (!r || !isOffset(r.offset) || typeof r.minute !== 'number' || r.minute < 0 || r.minute >= 1440) return null
  const popup = r.popup !== false
  const fullscreen = r.fullscreen === true
  return {
    id: typeof r.id === 'string' && r.id ? r.id : newId(),
    offset: { n: r.offset.n, unit: r.offset.unit },
    minute: Math.round(r.minute),
    popup: popup || !fullscreen,
    fullscreen,
    hint: typeof r.hint === 'string' ? r.hint.slice(0, 80) : '',
  }
}

const cleanReminders = (list: unknown): Reminder[] =>
  Array.isArray(list) ? list.map((r) => cleanReminder(r as Partial<Reminder>)).filter((r): r is Reminder => !!r) : []

function cleanSettings(raw: Partial<Settings> | undefined, fallbackZone: string): Settings {
  const base = defaultSettings(fallbackZone)
  if (!raw || typeof raw !== 'object') return base
  return {
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : base.enabled,
    defaults: Array.isArray(raw.defaults) ? cleanReminders(raw.defaults) : base.defaults,
    lockScreen: (['all', 'name', 'none'] as LockScreen[]).includes(raw.lockScreen as LockScreen) ? (raw.lockScreen as LockScreen) : base.lockScreen,
    feb29: (['feb28', 'mar1'] as Feb29[]).includes(raw.feb29 as Feb29) ? (raw.feb29 as Feb29) : base.feb29,
    homeZone: typeof raw.homeZone === 'string' && raw.homeZone ? raw.homeZone : base.homeZone,
    customOffsets: Array.isArray(raw.customOffsets) ? raw.customOffsets.filter(isOffset) : [],
    pauseBannerClosed: raw.pauseBannerClosed === true,
    groups: cleanGroups(raw.groups),
  }
}

function cleanContact(raw: unknown): ContactLink | null {
  const c = raw as Partial<ContactLink> | null | undefined
  if (!c || typeof c.id !== 'string' || !c.id || typeof c.name !== 'string' || typeof c.day !== 'number' || typeof c.month !== 'number') return null
  return { id: c.id, name: c.name, day: c.day, month: c.month, year: typeof c.year === 'number' ? c.year : null }
}

/** Prüft einen Datensatz aus der Datenbank oder einer Sicherung. */
export function cleanPerson(raw: Partial<Person>, now: number): Person | null {
  if (!raw || typeof raw !== 'object') return null
  const name = typeof raw.name === 'string' ? raw.name.trim() : ''
  const year = typeof raw.year === 'number' && Number.isInteger(raw.year) ? raw.year : null
  if (!name || typeof raw.day !== 'number' || typeof raw.month !== 'number' || !isValidBirthday(raw.day, raw.month, year)) return null
  const mode: ReminderMode = raw.mode === 'custom' || raw.mode === 'none' ? raw.mode : 'standard'
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : newId(),
    name: name.slice(0, 80),
    day: raw.day,
    month: raw.month,
    year,
    note: typeof raw.note === 'string' ? raw.note : '',
    photo: typeof raw.photo === 'string' && raw.photo ? raw.photo : null,
    zone: typeof raw.zone === 'string' && raw.zone ? raw.zone : null,
    contact: cleanContact(raw.contact),
    group: typeof raw.group === 'string' && raw.group ? raw.group : NO_GROUP,
    mode,
    reminders: cleanReminders(raw.reminders),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : now,
    updated: typeof raw.updated === 'number' ? raw.updated : now,
  }
}

/** Gleicher Name und gleicher Tag: dann gilt ein Eintrag als schon vorhanden. */
export const sameBirthday = (a: Pick<Person, 'name' | 'day' | 'month'>, b: Pick<Person, 'name' | 'day' | 'month'>) =>
  normalize(a.name) === normalize(b.name) && a.day === b.day && a.month === b.month

/**
 * Zentrale Datenhaltung der App. Jede Änderung der Oberfläche läuft über diese Klasse.
 * Sie speichert und meldet Änderungen an die Abonnenten (Oberfläche und Erinnerungsmodul).
 */
export class BirthdayStore {
  private people = new Map<string, Person>()
  /** Gelöschte Einträge, bis "Rückgängig" nicht mehr angeboten wird. */
  private trash = new Map<string, Person>()
  private settings: Settings
  private listeners = new Set<Listener>()
  private snapshot!: Snapshot
  private writes: Promise<void> = Promise.resolve()

  private constructor(
    private readonly repo: Repository,
    settings: Settings,
    private readonly now: () => number,
    private readonly starter: StarterGroup[],
  ) {
    this.settings = settings
  }

  /**
   * Öffnet den Speicher. starterGroups legt die App einmalig an: beim ersten Start, beim ersten
   * Start nach dem Update auf eine Version mit Start-Gruppen und nach "Alle Daten löschen".
   */
  static async open(repo: Repository, options: { now?: () => number; deviceZone?: string; starterGroups?: StarterGroup[] } = {}): Promise<BirthdayStore> {
    const now = options.now ?? Date.now
    const zone = options.deviceZone ?? 'Europe/Berlin'
    const raw = await repo.getMeta<Partial<Settings>>(SETTINGS_KEY)
    const settings = cleanSettings(raw, zone)
    if (!raw) await repo.setMeta(SETTINGS_KEY, settings)
    const store = new BirthdayStore(repo, settings, now, options.starterGroups ?? [])
    for (const doc of await repo.loadPeople()) {
      const p = cleanPerson(doc, now())
      if (p) store.people.set(p.id, p)
    }
    await store.addStarterGroups()
    store.fixGroups()
    store.rebuild()
    return store
  }

  // ---------- Lesen ----------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = (): Snapshot => this.snapshot

  get(id: string): Person | undefined {
    return this.people.get(id)
  }

  /** Alle Bilddateien, die noch gebraucht werden (auch von gelöschten Einträgen im Papierkorb). */
  photosInUse(): Set<string> {
    const names = new Set<string>()
    for (const p of [...this.people.values(), ...this.trash.values()]) if (p.photo) names.add(p.photo)
    return names
  }

  /** Kleine Werte der Oberfläche (z. B. welche Erlaubnisse übergangen wurden). */
  getMeta<T>(key: string): Promise<T | undefined> {
    return this.repo.getMeta<T>(key)
  }

  setMeta<T>(key: string, value: T): void {
    this.write(() => this.repo.setMeta(key, value))
  }

  /** Wartet, bis alle Änderungen gespeichert sind. */
  flush(): Promise<void> {
    return this.writes
  }

  // ---------- Einträge ----------

  create(input: PersonInput): Person {
    const t = this.now()
    const p = cleanPerson({ ...input, group: this.groupId(input.group), id: newId(), createdAt: t, updated: t }, t)
    if (!p) throw new Error('Ungültiger Eintrag')
    this.people.set(p.id, p)
    this.save([p])
    return p
  }

  update(id: string, patch: Partial<Omit<Person, 'id' | 'createdAt' | 'updated'>>): Person | undefined {
    const old = this.people.get(id)
    if (!old) return undefined
    const next = cleanPerson({ ...old, ...patch, updated: this.now() }, this.now())
    if (!next) return old
    this.people.set(id, next)
    this.save([next])
    return next
  }

  setReminders(id: string, mode: ReminderMode, reminders?: Reminder[]): void {
    const p = this.people.get(id)
    if (!p) return
    let list = reminders ?? p.reminders
    // Wer zum ersten Mal auf "Eigene" wechselt, bekommt den Standard als Startpunkt.
    if (mode === 'custom' && !reminders && p.reminders.length === 0) list = this.settings.defaults.map((r) => ({ ...r, id: newId() }))
    this.update(id, { mode, reminders: list })
  }

  remove(ids: string[]): void {
    const gone = ids.map((id) => this.people.get(id)).filter((p): p is Person => !!p)
    if (gone.length === 0) return
    for (const p of gone) {
      this.people.delete(p.id)
      this.trash.set(p.id, p)
    }
    this.rebuild()
    this.write(() => this.repo.deletePeople(gone.map((p) => p.id)))
  }

  restore(ids: string[]): void {
    const back = ids.map((id) => this.trash.get(id)).filter((p): p is Person => !!p)
    for (const p of back) {
      this.trash.delete(p.id)
      this.people.set(p.id, p)
    }
    this.save(back)
  }

  /** Vergisst gelöschte Einträge endgültig, damit ihre Bilder aufgeräumt werden können. */
  emptyTrash(): Person[] {
    const out = [...this.trash.values()]
    this.trash.clear()
    return out
  }

  /**
   * Übernimmt das Ergebnis eines Imports aus den Kontakten (siehe planContactImport):
   * neue Einträge anlegen, gewählte Änderungen aus dem Adressbuch übernehmen und bei allen
   * erkannten Einträgen den aktuellen Stand des Kontakts merken. Gibt die Zahl der neuen und
   * geänderten Einträge zurück.
   */
  applyContactImport(input: { add: ContactLink[]; group?: string | null; update: { id: string; contact: ContactLink; name: boolean; date: boolean }[]; link: { id: string; contact: ContactLink }[] }): { added: number; updated: number } {
    const t = this.now()
    const changed: Person[] = []
    let added = 0
    let updated = 0
    for (const c of input.add) {
      if ([...this.people.values()].some((p) => p.contact?.id === c.id || sameBirthday(p, c))) continue
      const p = cleanPerson({ name: c.name, day: c.day, month: c.month, year: c.year, contact: c, group: this.groupId(input.group), id: newId(), createdAt: t, updated: t }, t)
      if (!p) continue
      this.people.set(p.id, p)
      changed.push(p)
      added++
    }
    for (const u of input.update) {
      const old = this.people.get(u.id)
      if (!old) continue
      // Nur übernehmen, was sich im Adressbuch geändert hat. Ein in der App geänderter Name bleibt.
      const patch: Partial<Person> = { contact: u.contact, updated: t }
      if (u.name) patch.name = u.contact.name
      if (u.date) Object.assign(patch, { day: u.contact.day, month: u.contact.month, year: u.contact.year })
      const next = cleanPerson({ ...old, ...patch }, t)
      if (!next) continue
      this.people.set(next.id, next)
      changed.push(next)
      updated++
    }
    for (const l of input.link) {
      const old = this.people.get(l.id)
      if (!old || JSON.stringify(old.contact) === JSON.stringify(l.contact)) continue
      const next = { ...old, contact: l.contact, updated: t }
      this.people.set(next.id, next)
      changed.push(next)
    }
    this.save(changed)
    return { added, updated }
  }

  // ---------- Einstellungen ----------

  setSettings(patch: Partial<Settings>): void {
    const next = cleanSettings({ ...this.settings, ...patch }, this.settings.homeZone)
    // Wer die Erinnerungen wieder einschaltet und später erneut pausiert, sieht den Hinweis noch einmal.
    if (patch.enabled === true) next.pauseBannerClosed = false
    this.settings = next
    this.rebuild()
    this.write(() => this.repo.setMeta(SETTINGS_KEY, next))
  }

  addCustomOffset(o: Offset): void {
    const list = this.settings.customOffsets
    if (o.n === 0 || list.some((x) => offsetKey(x) === offsetKey(o))) return
    this.setSettings({ customOffsets: [...list, o] })
  }

  // ---------- Gruppen ----------

  /** Die Gruppe, falls es sie (noch) gibt. Einträge können auf gelöschte Gruppen zeigen, etwa nach einer Sicherung. */
  group(id: string | null | undefined): Group | undefined {
    return id ? this.settings.groups.find((g) => g.id === id) : undefined
  }

  /**
   * Gruppe mit diesem Namen (ohne Rücksicht auf Groß und Klein), außer der genannten.
   * "Ohne Gruppe" und "No group" sind für die feste Gruppe vergeben.
   */
  findGroupByName(name: string, exceptId?: string): Group | undefined {
    const key = normalize(name.trim())
    if (exceptId !== NO_GROUP && NO_GROUP_NAMES.some((n) => normalize(n) === key)) return this.group(NO_GROUP)
    return this.settings.groups.find((g) => g.id !== exceptId && g.id !== NO_GROUP && normalize(g.name) === key)
  }

  /** Legt eine Gruppe am Ende an. null, wenn der Name leer oder schon vergeben ist. */
  createGroup(name: string, color: ColorKey): Group | null {
    const clean = name.trim().slice(0, GROUP_NAME_MAX)
    if (!clean || this.findGroupByName(clean)) return null
    const g: Group = { id: newId(), name: clean, color }
    this.setSettings({ groups: [...this.settings.groups, g] })
    return g
  }

  updateGroup(id: string, patch: Partial<Pick<Group, 'name' | 'color'>>): void {
    if (id === NO_GROUP) return
    const name = patch.name?.trim().slice(0, GROUP_NAME_MAX)
    if (patch.name !== undefined && (!name || this.findGroupByName(name, id))) delete patch.name
    else if (name) patch.name = name
    this.setSettings({ groups: this.settings.groups.map((g) => (g.id === id ? { ...g, ...patch } : g)) })
  }

  /** Neue Reihenfolge der Gruppen. Unbekannte Kennungen fallen weg, fehlende kommen ans Ende. */
  setGroupOrder(order: string[]): void {
    const byId = new Map(this.settings.groups.map((g) => [g.id, g]))
    const next = order.map((id) => byId.get(id)).filter((g): g is Group => !!g)
    for (const g of this.settings.groups) if (!next.includes(g)) next.push(g)
    this.setSettings({ groups: next })
  }

  /** Ordnet einen Eintrag einer Gruppe zu (null oder unbekannt: "Ohne Gruppe"). */
  setGroup(personId: string, groupId: string | null): void {
    this.update(personId, { group: this.groupId(groupId) })
  }

  /**
   * Löscht eine Gruppe. Die Einträge bleiben und gehören danach zu "Ohne Gruppe", ihre Erinnerungen
   * ändern sich nicht. "Ohne Gruppe" selbst lässt sich nicht löschen. Gibt zurück, was "Rückgängig" braucht.
   */
  removeGroup(id: string): { group: Group; index: number; people: string[] } | null {
    if (id === NO_GROUP) return null
    const index = this.settings.groups.findIndex((g) => g.id === id)
    if (index < 0) return null
    const group = this.settings.groups[index]
    const t = this.now()
    const changed: Person[] = []
    for (const p of this.people.values()) {
      if (p.group !== id) continue
      const next = { ...p, group: NO_GROUP, updated: t }
      this.people.set(p.id, next)
      changed.push(next)
    }
    this.setSettings({ groups: this.settings.groups.filter((g) => g.id !== id) })
    this.save(changed)
    return { group, index, people: changed.map((p) => p.id) }
  }

  restoreGroup(undo: { group: Group; index: number; people: string[] }): void {
    if (this.group(undo.group.id) || this.findGroupByName(undo.group.name)) return
    const groups = [...this.settings.groups]
    groups.splice(Math.min(undo.index, groups.length), 0, undo.group)
    this.setSettings({ groups })
    const t = this.now()
    const changed: Person[] = []
    for (const pid of undo.people) {
      const p = this.people.get(pid)
      if (!p || p.group !== NO_GROUP) continue
      const next = { ...p, group: undo.group.id, updated: t }
      this.people.set(pid, next)
      changed.push(next)
    }
    this.save(changed)
  }

  /**
   * Legt die Start-Gruppen einmal an. Gruppen, die es unter diesem Namen schon gibt, kommen nicht doppelt,
   * die übrigen kommen ans Ende.
   */
  private async addStarterGroups(): Promise<void> {
    if (this.starter.length === 0 || (await this.repo.getMeta<boolean>(STARTER_KEY))) return
    const groups = [...this.settings.groups]
    for (const s of this.starter) {
      if (!groups.some((g) => normalize(g.name) === normalize(s.name))) groups.push({ id: newId(), name: s.name, color: s.color })
    }
    this.settings = cleanSettings({ ...this.settings, groups }, this.settings.homeZone)
    await this.repo.setMeta(SETTINGS_KEY, this.settings)
    await this.repo.setMeta(STARTER_KEY, true)
  }

  private groupId(id: string | null | undefined): string {
    return this.group(id)?.id ?? NO_GROUP
  }

  /** Einträge, deren Gruppe es nicht (mehr) gibt, etwa aus einer älteren Version oder Sicherung, kommen zu "Ohne Gruppe". */
  private fixGroups(): Person[] {
    const changed: Person[] = []
    for (const p of this.people.values()) {
      if (this.group(p.group)) continue
      const next = { ...p, group: NO_GROUP }
      this.people.set(p.id, next)
      changed.push(next)
    }
    return changed
  }

  // ---------- Sicherung ----------

  async exportBackup(photos: PhotoFiles): Promise<Backup> {
    const people: Backup['people'] = []
    for (const p of this.people.values()) people.push({ ...p, photoData: p.photo ? await photos.read(p.photo) : null })
    const { pauseBannerClosed: _, ...settings } = this.settings
    return { app: 'birthdays', format: 1, exportedAt: new Date(this.now()).toISOString(), people, settings }
  }

  /**
   * Spielt eine Sicherung ein. Einträge mit gleicher ID werden ersetzt, alle anderen bleiben.
   * Gibt die Zahl der eingespielten Einträge zurück.
   */
  async importBackup(data: unknown, photos: PhotoFiles): Promise<number> {
    const backup = data as Partial<Backup>
    if (!backup || backup.app !== 'birthdays' || backup.format !== 1) throw new BackupError('not-a-backup')
    if (!Array.isArray(backup.people)) throw new BackupError('damaged')
    const t = this.now()
    const incoming: Person[] = []
    for (const raw of backup.people) {
      const p = cleanPerson(raw, t)
      if (!p) continue
      p.photo = null
      const data64 = (raw as { photoData?: unknown }).photoData
      if (typeof data64 === 'string' && data64) {
        try {
          p.photo = await photos.write(data64)
        } catch {
          p.photo = null
        }
      }
      incoming.push(p)
    }
    if (backup.people.length > 0 && incoming.length === 0) throw new BackupError('damaged')
    for (const p of incoming) this.people.set(p.id, p)
    if (backup.settings) {
      const s = cleanSettings({ ...backup.settings, pauseBannerClosed: false }, this.settings.homeZone)
      this.settings = s
      this.write(() => this.repo.setMeta(SETTINGS_KEY, s))
    }
    const fixed = this.fixGroups()
    const ids = new Set([...incoming, ...fixed].map((p) => p.id))
    this.save([...ids].map((id) => this.people.get(id)!))
    return incoming.length
  }

  /** Löscht alle Einträge und Gruppen. Die genannten Werte (Darstellung, Sprache, Schrift) bleiben erhalten, die Start-Gruppen kommen neu. */
  async reset(options: { keepMeta?: string[] } = {}): Promise<Person[]> {
    await this.writes
    const kept: [string, unknown][] = []
    for (const key of options.keepMeta ?? []) {
      const v = await this.repo.getMeta(key)
      if (v !== undefined) kept.push([key, v])
    }
    const gone = [...this.people.values(), ...this.trash.values()]
    await this.repo.clear()
    for (const [k, v] of kept) await this.repo.setMeta(k, v)
    this.people.clear()
    this.trash.clear()
    this.settings = defaultSettings(this.settings.homeZone)
    await this.repo.setMeta(SETTINGS_KEY, this.settings)
    // Wie nach der Installation: die Start-Gruppen sind wieder da.
    await this.addStarterGroups()
    this.rebuild()
    return gone
  }

  // ---------- intern ----------

  private save(people: Person[]) {
    this.rebuild()
    if (people.length) this.write(() => this.repo.putPeople(people))
  }

  private write(task: () => Promise<void>) {
    this.writes = this.writes.then(task).catch((error) => console.error('Speichern fehlgeschlagen', error))
  }

  private rebuild() {
    this.snapshot = {
      people: [...this.people.values()].sort((a, b) => a.name.localeCompare(b.name)),
      settings: this.settings,
    }
    for (const l of this.listeners) l()
  }
}
