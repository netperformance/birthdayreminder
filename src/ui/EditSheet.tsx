import { useEffect, useRef, useState } from 'react'
import { Keyboard, StyleSheet, Text, TextInput, View, type TextInputInstance } from 'react-native'
import { dateFieldInput, expandYear, isValidBirthday } from '../domain/dates'
import { longDate } from '../domain/format'
import { newId, NO_GROUP, type ReminderMode } from '../domain/model'
import { nextBirthday } from '../domain/schedule'
import { Card, Chip, Hint, Label, Row, Segmented } from './controls'
import { useEnv } from './env'
import { GroupDot, GroupPicker, useGroupName } from './Groups'
import { haptic } from './haptics'
import { useLang, useT } from './i18n'
import { Input } from './Input'
import { placeTitle, signLabel } from './labels'
import { Sheet } from './Sheet'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'
import { ZonePicker } from './ZonePicker'
import { zoneCity } from '../domain/zone'

type Field = 'day' | 'month' | 'year'

/** Neuer Eintrag (Screen 2) und Bearbeiten von Name, Datum und Zeitzone. */
export function EditSheet({
  open,
  id,
  onClose,
  onCreated,
  initialGroup = null,
}: {
  open: boolean
  /** null: neuer Eintrag */
  id: string | null
  onClose: () => void
  onCreated?: (hasReminders: boolean, id: string, mode: ReminderMode) => void
  /** Gruppe für einen neuen Eintrag, etwa die auf der Startseite gewählte. */
  initialGroup?: string | null
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const env = useEnv()
  const store = useBirthdayStore()
  const { settings } = useSnapshot()
  const existing = id ? store.get(id) : undefined

  const [name, setName] = useState('')
  /** Tag, Monat, Jahr in je einem eigenen Feld, siehe dateFieldInput. */
  const [dateParts, setDateParts] = useState<Record<Field, string>>({ day: '', month: '', year: '' })
  const [focused, setFocused] = useState<Field | null>(null)
  /** Das Feld wurde gerade angetippt: Die erste Ziffer ersetzt den alten Inhalt. */
  const fresh = useRef(false)
  /** Erzwingt ein Neuzeichnen, damit das Feld immer den Inhalt aus dateParts zeigt. */
  const [, setTick] = useState(0)
  const [note, setNote] = useState('')
  const [mode, setMode] = useState<ReminderMode>('standard')
  const [zone, setZone] = useState<string | null>(null)
  const [zonePicker, setZonePicker] = useState(false)
  const [group, setGroup] = useState<string>(NO_GROUP)
  const groupName = useGroupName()
  const [groupPicker, setGroupPicker] = useState(false)
  const groupInfo = settings.groups.find((g) => g.id === group)
  const dayRef = useRef<TextInputInstance>(null)
  const monthRef = useRef<TextInputInstance>(null)
  const yearRef = useRef<TextInputInstance>(null)
  const dateRefs: Record<Field, typeof dayRef> = { day: dayRef, month: monthRef, year: yearRef }
  const nameRef = useRef<TextInputInstance>(null)

  useEffect(() => {
    if (!open) return
    setName(existing?.name ?? '')
    setDateParts(
      existing
        ? { day: String(existing.day).padStart(2, '0'), month: String(existing.month).padStart(2, '0'), year: existing.year ? String(existing.year) : '' }
        : { day: '', month: '', year: '' },
    )
    setFocused(null)
    setNote('')
    setMode('standard')
    setZone(existing?.zone ?? null)
    setGroup(existing ? existing.group : initialGroup ?? NO_GROUP)
    if (!existing) setTimeout(() => nameRef.current?.focus(), 350)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id])

  const order: Field[] = env.style.lang === 'en' && !env.style.dayFirst ? ['month', 'day', 'year'] : ['day', 'month', 'year']
  const { day, month, year } = dateParts

  const currentYear = new Date(env.now).getFullYear()
  const d = Number(day)
  const m = Number(month)
  const y = year ? expandYear(year, currentYear) : null
  /** Jahr halb getippt (1 oder 3 Ziffern): noch keine Vorschau, noch nicht speicherbar. */
  const yearPartial = year.length === 1 || year.length === 3
  const yearOk = !year || (!yearPartial && y !== null && y >= 1900 && y <= currentYear)
  const complete = !!day && !!month && !yearPartial
  const valid = !!name.trim() && complete && yearOk && isValidBirthday(d, m, y)

  const onDate = (field: Field, text: string) => {
    const { value, next } = dateFieldInput(field, dateParts[field], text, fresh.current)
    fresh.current = false
    setDateParts((p) => ({ ...p, [field]: value }))
    setTick((n) => n + 1)
    if (!next) return
    const i = order.indexOf(field)
    if (i < 2) {
      fresh.current = true
      dateRefs[order[i + 1]].current?.focus()
    } else Keyboard.dismiss()
  }

  /** Löschen im leeren Feld: zurück ins vorige Feld und dort die letzte Ziffer löschen. */
  const onDateKey = (field: Field, key: string) => {
    if (key !== 'Backspace' || dateParts[field]) return
    const i = order.indexOf(field)
    if (i === 0) return
    const prev = order[i - 1]
    fresh.current = false
    setDateParts((p) => ({ ...p, [prev]: p[prev].slice(0, -1) }))
    dateRefs[prev].current?.focus()
  }

  /** Jahr weglassen: nur Tag und Monat behalten. */
  const withoutYear = () => {
    setDateParts((p) => ({ ...p, year: '' }))
    Keyboard.dismiss()
  }

  let preview: string | null = null
  let previewBad = false
  if (complete && isValidBirthday(d, m, y) && yearOk) {
    const next = nextBirthday({ day: d, month: m, year: y, zone }, env.now, env.ctx)
    const sign = signLabel(m, d, lang)
    preview = `${longDate(next.window.day, env.style)} · ${t.inDaysLong(next.days)}\n${[next.window.age !== null ? t.turns(next.window.age) : null, sign.full].filter(Boolean).join(' · ')}`
  } else if (complete && (!isValidBirthday(d, m, y) || !yearOk)) {
    preview = t.invalidDate
    previewBad = true
  }

  const save = () => {
    if (!valid) return
    haptic('success')
    if (existing) {
      store.update(existing.id, { name: name.trim(), day: d, month: m, year: y, zone })
    } else {
      const p = store.create({
        name: name.trim(),
        day: d,
        month: m,
        year: y,
        note: note.trim(),
        group,
        mode,
        reminders: mode === 'custom' ? settings.defaults.map((r) => ({ ...r, id: newId() })) : [],
      })
      onCreated?.(mode !== 'none' && (mode === 'custom' || settings.defaults.length > 0), p.id, mode)
    }
    onClose()
  }

  const dateBox = (field: Field) => {
    const label = field === 'day' ? t.dayLabel : field === 'month' ? t.monthLabel : t.yearLabel
    const active = focused === field
    return (
      <View key={field} style={[styles.datePart, field === 'year' && { flex: 1.5 }, { backgroundColor: c.card, borderColor: active ? c.accentText : 'transparent' }]}>
        {/* Antippen wählt das Feld, die erste Ziffer ersetzt den Inhalt. Nichts ist vorab markiert. */}
        <TextInput
          ref={dateRefs[field]}
          value={dateParts[field]}
          onChangeText={(text) => onDate(field, text)}
          onKeyPress={(e) => onDateKey(field, e.nativeEvent.key)}
          onFocus={() => {
            if (focused !== field) fresh.current = true
            setFocused(field)
          }}
          onBlur={() => setFocused((x) => (x === field ? null : x))}
          keyboardType="number-pad"
          selectTextOnFocus={false}
          caretHidden
          contextMenuHidden
          autoCorrect={false}
          placeholder={field === 'year' ? '' : '–'}
          placeholderTextColor={c.text3}
          style={[styles.dateValue, styles.dateInput, { color: c.text, fontSize: f(22) }]}
          accessibilityLabel={label}
        />
        <Text style={{ color: c.text3, fontSize: f(10.5), fontWeight: '600', letterSpacing: 0.5 }} numberOfLines={1}>
          {label}
        </Text>
      </View>
    )
  }

  return (
    <Sheet
      open={open}
      title={existing ? t.editEntry : t.newEntry}
      onClose={onClose}
      left={{ label: t.cancel, onPress: onClose }}
      right={{ label: t.save, onPress: save, disabled: !valid }}
    >
      <Label first>{t.name}</Label>
      <View style={[styles.field, { backgroundColor: c.card }]}>
        <Input
          ref={nameRef}
          value={name}
          onChangeText={setName}
          style={[styles.input, { color: c.text, fontSize: f(16) }]}
          placeholder="Lisa Bergmann"
          placeholderTextColor={c.text3}
          cursorColor={c.accentText}
          autoCapitalize="words"
          returnKeyType="next"
          onSubmitEditing={() => {
            fresh.current = true
            dateRefs[order[0]].current?.focus()
          }}
          maxLength={80}
          accessibilityLabel={t.name}
        />
      </View>

      <Label>{t.birthday}</Label>
      <View style={styles.date}>{order.map(dateBox)}</View>
      <View style={styles.yearRow}>
        <Chip label={t.withoutYear} active={!year && complete} onPress={withoutYear} />
      </View>
      {preview && (
        <View style={[styles.preview, { backgroundColor: previewBad ? 'rgba(217,56,56,0.1)' : c.accentSoft }]}>
          <Text style={{ color: previewBad ? c.danger : c.accentDeep, fontWeight: '600', fontSize: f(13.5), lineHeight: f(20) }}>{preview}</Text>
        </View>
      )}

      {!existing && (
        <>
          <Label>{t.note}</Label>
          <View style={[styles.field, { backgroundColor: c.card }]}>
            <Input
              value={note}
              onChangeText={setNote}
              style={[styles.input, { color: c.text, fontSize: f(15), minHeight: 46 }]}
              placeholder={t.notePlaceholder}
              placeholderTextColor={c.text3}
              cursorColor={c.accentText}
              multiline
              accessibilityLabel={t.note}
            />
          </View>
          <Label>{t.groupLabel}</Label>
          <Card>
            <Row
              label={groupName(groupInfo)}
              lead={<GroupDot group={groupInfo} />}
              chevron
              last
              onPress={() => {
                Keyboard.dismiss()
                setGroupPicker(true)
              }}
            />
          </Card>
          <Label>{t.reminder}</Label>
          <Segmented
            options={[
              ['standard', t.modeStandard],
              ['custom', t.modeCustom],
              ['none', t.modeNone],
            ]}
            value={mode}
            onChange={setMode}
          />
          <Hint>{mode === 'none' ? t.noneHint : mode === 'custom' ? '' : t.standardHint}</Hint>
        </>
      )}

      {existing && (
        <>
          <Label>{t.livesIn}</Label>
          <Card>
            <Row
              icon="public"
              label={zone ? zoneCity(zone) : t.home(placeTitle(settings.homeZone, lang))}
              chevron
              last
              onPress={() => {
                Keyboard.dismiss()
                setZonePicker(true)
              }}
            />
          </Card>
        </>
      )}
      <GroupPicker open={groupPicker} value={group} onPick={setGroup} onClose={() => setGroupPicker(false)} />
      <ZonePicker
        open={zonePicker}
        value={zone}
        allowHome
        onPick={(z) => {
          setZone(z)
          setZonePicker(false)
        }}
        onClose={() => setZonePicker(false)}
      />
    </Sheet>
  )
}

const styles = StyleSheet.create({
  field: { borderRadius: 14, paddingHorizontal: 14 },
  input: { paddingVertical: 12 },
  date: { flexDirection: 'row', gap: 8 },
  datePart: { flex: 1, borderRadius: 14, alignItems: 'center', paddingTop: 8, paddingBottom: 8, borderWidth: 2 },
  dateValue: { fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  dateInput: { alignSelf: 'stretch', paddingVertical: 0, paddingHorizontal: 4, includeFontPadding: false },
  yearRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
  preview: { marginTop: 10, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
})
