import DateTimePicker from '@react-native-community/datetimepicker'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useState } from 'react'
import { Keyboard, Pressable, StyleSheet, Text, View } from 'react-native'
import { minusOffset } from '../domain/dates'
import { longDate, shortDate, time } from '../domain/format'
import { newId, offsetKey, PRESET_OFFSETS, type Offset, type OffsetUnit, type Person, type Reminder } from '../domain/model'
import { nextBirthday, nextOccurrence } from '../domain/schedule'
import { localDay } from '../domain/zone'
import { Button, Card, Chip, Label, Row, Segmented, Toggle } from './controls'
import { useEnv } from './env'
import { haptic } from './haptics'
import { useT } from './i18n'
import { Input } from './Input'
import { Sheet } from './Sheet'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'

export interface ReminderResult {
  /** Die bearbeitete Erinnerung (gleiche ID), falls eine bearbeitet wurde. */
  updated: Reminder | null
  /** Neu hinzugekommene Erinnerungen, eine je zusätzlich gewähltem Abstand. */
  added: Reminder[]
}

/**
 * Erinnerung hinzufügen oder bearbeiten (Screens 5 und 5b). Mehrere Abstände lassen sich
 * gleichzeitig wählen, daraus entsteht je Abstand eine Erinnerung. Popup ist vorausgewählt.
 */
export function ReminderSheet({
  open,
  person,
  existing,
  onSubmit,
  onDelete,
  onClose,
}: {
  open: boolean
  /** Für die Vorschau der Daten. Fehlt bei den Standard-Erinnerungen der Einstellungen. */
  person?: Person
  existing?: Reminder
  onSubmit: (result: ReminderResult) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const env = useEnv()
  const store = useBirthdayStore()
  const { settings } = useSnapshot()

  const [selected, setSelected] = useState<Offset[]>([])
  const [minute, setMinute] = useState(9 * 60)
  const [popup, setPopup] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [hint, setHint] = useState('')
  const [custom, setCustom] = useState<{ n: number; unit: OffsetUnit } | null>(null)
  const [picking, setPicking] = useState(false)

  useEffect(() => {
    if (!open) return
    setSelected(existing ? [existing.offset] : [PRESET_OFFSETS[0]])
    setMinute(existing?.minute ?? 9 * 60)
    setPopup(existing?.popup ?? true)
    setFullscreen(existing?.fullscreen ?? false)
    setHint(existing?.hint ?? '')
    setCustom(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  const options = [...PRESET_OFFSETS, ...settings.customOffsets.filter((o) => !PRESET_OFFSETS.some((p) => offsetKey(p) === offsetKey(o)))]
  if (existing && !options.some((o) => offsetKey(o) === offsetKey(existing.offset))) options.push(existing.offset)
  const isOn = (o: Offset) => selected.some((s) => offsetKey(s) === offsetKey(o))
  const toggle = (o: Offset) => setSelected((list) => (isOn(o) ? list.filter((s) => offsetKey(s) !== offsetKey(o)) : [...list, o]))

  const valid = selected.length > 0 && (popup || fullscreen)

  const submit = () => {
    if (!valid) return
    haptic('success')
    const base = { minute, popup, fullscreen, hint: hint.trim() }
    let list = [...selected]
    let updated: Reminder | null = null
    if (existing) {
      const keep = list.find((o) => offsetKey(o) === offsetKey(existing.offset)) ?? list[0]
      updated = { ...existing, ...base, offset: keep }
      list = list.filter((o) => o !== keep)
    }
    onSubmit({ updated, added: list.map((o) => ({ id: newId(), offset: o, ...base })) })
    onClose()
  }

  // Vorschau: echte Daten der nächsten Auslösung (bei einem Eintrag)
  const dates = person
    ? selected
        .map((o) => nextOccurrence(person, { offset: o, minute }, env.now, env.ctx))
        .filter((x): x is NonNullable<typeof x> => !!x)
        .sort((a, b) => a.at - b.at)
        .map((x) => shortDate(localDay(x.at, env.ctx.myZone, env.ctx.info), env.style))
    : []

  const customResult = (() => {
    if (!custom || !person) return null
    const next = nextBirthday(person, env.now, env.ctx)
    return longDate(minusOffset(next.window.day, { n: custom.n, unit: custom.unit }), env.style)
  })()

  const timeDate = new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60)

  return (
    <Sheet
      open={open}
      title={t.reminderTitle}
      onClose={onClose}
      left={{ label: t.cancel, onPress: onClose }}
      right={{ label: existing ? t.done : t.add, onPress: submit, disabled: !valid }}
    >
      <Label first right={<Text style={{ color: c.text3, fontSize: f(12.5) }}>{t.severalPossible}</Text>}>
        {t.when}
      </Label>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={offsetKey(o)} label={t.offsetChip(o)} active={isOn(o)} onPress={() => toggle(o)} />
        ))}
        <Chip
          label={t.customChip}
          icon="add"
          outlined={!!custom}
          onPress={() => {
            Keyboard.dismiss()
            setCustom((v) => (v ? null : { n: 5, unit: 'd' }))
          }}
        />
      </View>

      {custom && (
        <View style={[styles.panel, { backgroundColor: c.card, borderColor: c.accentText }]}>
          <Text style={{ color: c.text, fontWeight: '700', fontSize: f(15) }}>{t.howLong}</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setCustom((v) => v && { ...v, n: Math.max(1, v.n - 1) })}
              style={[styles.step, { backgroundColor: c.accentSoft }]}
              accessibilityRole="button"
              accessibilityLabel={t.minus}
            >
              <MaterialIcons name="remove" size={24} color={c.accentDeep} />
            </Pressable>
            <Input
              value={String(custom.n)}
              onChangeText={(v) => {
                const n = Number(v.replace(/\D/g, ''))
                setCustom((x) => x && { ...x, n: Math.min(365, Math.max(1, n || 1)) })
              }}
              keyboardType="number-pad"
              maxLength={3}
              selectTextOnFocus
              style={[styles.stepValue, { color: c.text, fontSize: f(32) }]}
              accessibilityLabel={t.howLong}
            />
            <Pressable
              onPress={() => setCustom((v) => v && { ...v, n: Math.min(365, v.n + 1) })}
              style={[styles.step, { backgroundColor: c.accentSoft }]}
              accessibilityRole="button"
              accessibilityLabel={t.plus}
            >
              <MaterialIcons name="add" size={24} color={c.accentDeep} />
            </Pressable>
          </View>
          <Segmented
            compact
            options={[
              ['d', t.units.d],
              ['w', t.units.w],
              ['m', t.units.m],
            ]}
            value={custom.unit}
            onChange={(unit) => setCustom((v) => v && { ...v, unit })}
          />
          {customResult && <Text style={{ color: c.text2, fontSize: f(14), textAlign: 'center', marginTop: 10 }}>{t.results(customResult)}</Text>}
          <View style={{ marginTop: 12 }}>
            <Button
              label={t.takeOver(custom)}
              onPress={() => {
                const o = { n: custom.n, unit: custom.unit }
                store.addCustomOffset(o)
                setSelected((list) => (list.some((s) => offsetKey(s) === offsetKey(o)) ? list : [...list, o]))
                setCustom(null)
                haptic('success')
              }}
            />
          </View>
        </View>
      )}

      <Label>{t.time}</Label>
      <Pressable onPress={() => setPicking(true)} style={[styles.time, { backgroundColor: c.card }]} accessibilityRole="button" accessibilityLabel={`${t.time} ${time(minute, env.style)}`}>
        <Text style={{ color: c.text, fontSize: f(22), fontWeight: '700', letterSpacing: 1 }}>{time(minute, env.style)}</Text>
      </Pressable>
      {picking && (
        <DateTimePicker
          value={timeDate}
          mode="time"
          is24Hour={env.style.h24}
          onChange={(e, d) => {
            setPicking(false)
            if (e.type === 'set' && d) setMinute(d.getHours() * 60 + d.getMinutes())
          }}
        />
      )}

      <Label>{t.how}</Label>
      <Card>
        <Row icon="smartphone" label={t.popup} sub={t.popupSub} right={<Toggle value={popup} onChange={setPopup} />} onPress={() => setPopup(!popup)} />
        <Row icon="fullscreen" label={t.fullscreen} sub={t.fullscreenSub} right={<Toggle value={fullscreen} onChange={setFullscreen} />} onPress={() => setFullscreen(!fullscreen)} last />
      </Card>
      {!popup && !fullscreen && <Text style={{ color: c.danger, fontSize: f(13), marginTop: 8, marginLeft: 4 }}>{t.pickOne}</Text>}

      <Label>{t.hint}</Label>
      <View style={[styles.field, { backgroundColor: c.card }]}>
        <Input
          value={hint}
          onChangeText={setHint}
          placeholder={t.hintPlaceholder}
          placeholderTextColor={c.text3}
          cursorColor={c.accentText}
          style={{ color: c.text, fontSize: f(16), paddingVertical: 12 }}
          maxLength={80}
          accessibilityLabel={t.hint}
        />
      </View>

      {selected.length > 0 && (
        <View style={[styles.preview, { backgroundColor: c.accentSoft }]}>
          <Text style={{ color: c.accentDeep, fontWeight: '600', fontSize: f(13.5), textAlign: 'center', lineHeight: f(20) }}>
            {t.preview(selected.length, time(minute, env.style))}
            {dates.length > 0 ? `:\n${t.previewDates(dates)}` : ''}
          </Text>
        </View>
      )}

      {existing && onDelete && (
        <Card style={{ marginTop: 16 }}>
          <Row
            icon="delete-outline"
            label={t.deleteReminder}
            danger
            last
            onPress={() => {
              onDelete()
              onClose()
            }}
          />
        </Card>
      )}
    </Sheet>
  )
}


const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  panel: { marginTop: 12, borderRadius: 16, padding: 14, borderWidth: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, marginVertical: 10 },
  step: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  stepValue: { fontWeight: '800', minWidth: 70, textAlign: 'center' },
  time: { borderRadius: 14, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  field: { borderRadius: 14, paddingHorizontal: 14 },
  preview: { marginTop: 14, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
})
