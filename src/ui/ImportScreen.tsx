import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import * as Contacts from 'expo-contacts/legacy'
import { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { alarms } from '../../modules/birthday-alarms'
import { isValidBirthday } from '../domain/dates'
import { birthDate } from '../domain/format'
import { NO_GROUP, type ContactLink } from '../domain/model'
import { normalize } from '../domain/normalize'
import { planContactImport, type PlanItem } from '../store/contacts'
import { Button, Card, Row } from './controls'
import { useEnv } from './env'
import { GroupDot, GroupPicker, useGroupName } from './Groups'
import { haptic } from './haptics'
import { useT } from './i18n'
import { signLabel } from './labels'
import { useSnackbar } from './Snackbar'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'

/** Geburtstag eines Kontakts: das Feld "Geburtstag" oder ein Ereignis mit "Geburtstag"/"Birthday" im Namen. */
function birthdayOf(contact: Contacts.Contact): { day: number; month: number; year: number | null } | null {
  const candidates: Contacts.Date[] = []
  if (contact.birthday) candidates.push(contact.birthday)
  for (const d of contact.dates ?? []) if (/geburt|birth/i.test(d.label ?? '')) candidates.push(d)
  for (const d of candidates) {
    const month = (d.month ?? -1) + 1 // expo-contacts zählt Monate ab 0
    const day = d.day ?? 0
    const year = typeof d.year === 'number' && d.year > 1800 ? d.year : null
    if (isValidBirthday(day, month, year)) return { day, month, year }
  }
  return null
}

/**
 * Aus Kontakten importieren (Screen 13), beliebig oft wiederholbar. Neue Kontakte sind
 * vorausgewählt, im Adressbuch geänderte stehen in einem eigenen Abschnitt und werden nur mit
 * Häkchen übernommen, vorhandene sind ausgegraut. Siehe planContactImport.
 */
export function ImportScreen({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (n: number) => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const env = useEnv()
  const insets = useSafeAreaInsets()
  const store = useBirthdayStore()
  const { people, settings } = useSnapshot()
  const snack = useSnackbar()
  const [state, setState] = useState<'loading' | 'denied' | 'ready'>('loading')
  const [found, setFound] = useState<ContactLink[]>([])
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [group, setGroup] = useState<string>(NO_GROUP)
  const groupName = useGroupName()
  const [groupPicker, setGroupPicker] = useState(false)
  const groupInfo = settings.groups.find((g) => g.id === group)

  useEffect(() => {
    if (!open) return
    setState('loading')
    setGroup(NO_GROUP)
    ;(async () => {
      try {
        const perm = await Contacts.requestPermissionsAsync()
        if (!perm.granted) {
          setState('denied')
          return
        }
        const res = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.Birthday, Contacts.Fields.Dates] })
        const list: ContactLink[] = []
        const seen = new Set<string>()
        for (const contact of res.data) {
          const name = (contact.name ?? [contact.firstName, contact.lastName].filter(Boolean).join(' ')).trim()
          const b = birthdayOf(contact)
          if (!name || !b || !contact.id) continue
          const key = `${normalize(name)}|${b.day}|${b.month}`
          if (seen.has(key)) continue // dieselbe Person doppelt im Adressbuch (z. B. Google und Samsung)
          seen.add(key)
          list.push({ id: contact.id, name, ...b })
        }
        list.sort((a, b) => a.name.localeCompare(b.name))
        setFound(list)
        const plan = planContactImport(people, list)
        setChosen(new Set(plan.filter((x) => x.kind === 'new').map((x) => x.contact.id)))
        setState('ready')
      } catch {
        setState('denied')
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const plan = useMemo(() => planContactImport(people, found), [people, found])
  const fresh = plan.filter((x) => x.kind === 'new')
  const changed = plan.filter((x): x is Extract<PlanItem, { kind: 'changed' }> => x.kind === 'changed')
  const same = plan.filter((x): x is Extract<PlanItem, { kind: 'same' }> => x.kind === 'same')
  const selectable = [...fresh, ...changed]
  const allOn = selectable.length > 0 && selectable.every((x) => chosen.has(x.contact.id))
  const count = selectable.filter((x) => chosen.has(x.contact.id)).length

  const toggle = (id: string) => {
    haptic('tick')
    setChosen((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const run = () => {
    const result = store.applyContactImport({
      add: fresh.filter((x) => chosen.has(x.contact.id)).map((x) => x.contact),
      group,
      update: changed.filter((x) => chosen.has(x.contact.id)).map((x) => ({ id: x.person.id, contact: x.contact, name: x.name, date: x.date })),
      // Vorhandene merken sich den aktuellen Stand des Kontakts, damit der nächste Import sie sicher erkennt.
      link: same.map((x) => ({ id: x.person.id, contact: x.contact })),
    })
    haptic('success')
    snack({ message: t.importResult(result.added, result.updated) })
    onImported(result.added)
    onClose()
  }

  if (!open) return null

  const label = (text: string) => <Text style={[styles.label, { color: c.text2, fontSize: f(12) }]}>{text}</Text>
  const date = (x: { day: number; month: number; year: number | null }) => birthDate(x.day, x.month, x.year, env.style)

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <Pressable onPress={onClose} style={styles.icon} accessibilityRole="button" accessibilityLabel={t.back}>
            <MaterialIcons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          <Text style={{ flex: 1, color: c.text, fontWeight: '700', fontSize: f(18) }}>{t.fromContacts}</Text>
          {state === 'ready' && selectable.length > 0 && (
            <Pressable
              onPress={() => setChosen(allOn ? new Set() : new Set(selectable.map((x) => x.contact.id)))}
              style={{ paddingHorizontal: 14, paddingVertical: 10 }}
              accessibilityRole="button"
            >
              <Text style={{ color: c.accentText, fontWeight: '700', fontSize: f(15) }}>{allOn ? t.none : t.all}</Text>
            </Pressable>
          )}
        </View>
        {state === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator color={c.accentText} />
            <Text style={{ color: c.text2, marginTop: 10, fontSize: f(15) }}>{t.loading}</Text>
          </View>
        )}
        {state === 'denied' && (
          <View style={styles.center}>
            <Text style={{ color: c.text2, fontSize: f(15), textAlign: 'center', lineHeight: f(22) }}>{t.contactsDenied}</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 16 }}>
              <Button label={t.openAndroidSettings} kind="plain" onPress={() => alarms.openSettings('app')} />
            </View>
          </View>
        )}
        {state === 'ready' && (
          <>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 + insets.bottom }}>
              <Text style={{ color: c.text2, fontSize: f(14), marginTop: 2, marginLeft: 4 }}>{t.foundContacts(found.length)}</Text>
              <Text style={{ color: c.text2, fontSize: f(13), marginTop: 6, marginLeft: 4, lineHeight: f(18) }}>{t.onlyWithBirthday}</Text>
              {found.length === 0 && <Text style={{ color: c.text2, fontSize: f(15), textAlign: 'center', marginTop: 30 }}>{t.noContacts}</Text>}
              {found.length > 0 && selectable.length === 0 && <Text style={{ color: c.text, fontSize: f(15), textAlign: 'center', marginTop: 24 }}>{t.upToDate}</Text>}

              {fresh.length > 0 && (
                <>
                  {label(t.groupForNew.toLocaleUpperCase())}
                  <Card>
                    <Row label={groupName(groupInfo)} lead={<GroupDot group={groupInfo} />} chevron last onPress={() => setGroupPicker(true)} />
                  </Card>
                  {label(t.sectionNew)}
                  <Group>
                    {fresh.map((x, i) => (
                      <CheckRow key={x.contact.id} on={chosen.has(x.contact.id)} onPress={() => toggle(x.contact.id)} last={i === fresh.length - 1} title={x.contact.name}>
                        {`${date(x.contact)}${x.contact.year ? '' : ` · ${t.noYear}`} · ${signLabel(x.contact.month, x.contact.day, env.style.lang).symbol}`}
                      </CheckRow>
                    ))}
                  </Group>
                </>
              )}

              {changed.length > 0 && (
                <>
                  {label(t.sectionChanged)}
                  <Group>
                    {changed.map((x, i) => (
                      <CheckRow key={x.contact.id} on={chosen.has(x.contact.id)} onPress={() => toggle(x.contact.id)} last={i === changed.length - 1} title={x.person.name}>
                        {[x.name ? t.changedName(x.contact.name, x.person.name) : null, x.date ? t.changedDate(date(x.contact), date(x.person)) : null].filter(Boolean).join('\n')}
                      </CheckRow>
                    ))}
                  </Group>
                  <Text style={{ color: c.text2, fontSize: f(12.5), marginTop: 8, marginLeft: 4, lineHeight: f(17) }}>{t.changedHint}</Text>
                </>
              )}

              {same.length > 0 && (
                <>
                  {label(`${t.sectionSame} · ${same.length}`)}
                  <Group>
                    {same.map((x, i) => (
                      <CheckRow key={x.contact.id} on disabled last={i === same.length - 1} title={x.person.name}>
                        {date(x.person)}
                      </CheckRow>
                    ))}
                  </Group>
                </>
              )}
            </ScrollView>
            {selectable.length > 0 && (
              <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: c.bg }]}>
                <Button label={t.applyN(count)} onPress={run} disabled={count === 0} />
              </View>
            )}
          </>
        )}
      </View>
      <GroupPicker open={groupPicker} value={group} onPick={setGroup} onClose={() => setGroupPicker(false)} />
    </Modal>
  )
}

function Group({ children }: { children: React.ReactNode }) {
  const c = useColors()
  return <View style={[styles.group, { backgroundColor: c.card }]}>{children}</View>
}

function CheckRow({ on, disabled, onPress, last, title, children }: { on: boolean; disabled?: boolean; onPress?: () => void; last: boolean; title: string; children: string }) {
  const c = useColors()
  const f = useFont()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: c.ripple }}
      style={[styles.row, { opacity: disabled ? 0.5 : 1 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: on, disabled: !!disabled }}
    >
      <View style={[styles.box, { borderColor: on ? (disabled ? c.text3 : c.accent) : c.text3, backgroundColor: on ? (disabled ? c.text3 : c.accent) : 'transparent' }]}>
        {on && <MaterialIcons name="check" size={16} color={disabled ? '#fff' : c.onAccent} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: c.text, fontWeight: '600', fontSize: f(16) }} numberOfLines={1}>
          {title}
        </Text>
        <Text style={{ color: c.text2, fontSize: f(13), marginTop: 2, lineHeight: f(18) }}>{children}</Text>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', height: 56, paddingHorizontal: 4 },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  label: { fontWeight: '700', letterSpacing: 0.6, marginTop: 18, marginBottom: 8, marginLeft: 4 },
  group: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 14, paddingVertical: 11, minHeight: 60 },
  box: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10 },
})
