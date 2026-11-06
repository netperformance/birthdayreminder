import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { birthDate, dayMonthLong, longDate, weekdayName } from '../domain/format'
import type { ReminderMode } from '../domain/model'
import { nextBirthday } from '../domain/schedule'
import { Avatar, Card, Hint, Label, Row, Segmented } from './controls'
import { EditSheet } from './EditSheet'
import { useEnv } from './env'
import { GroupDot, GroupPicker, useGroupName } from './Groups'
import { useLang, useT } from './i18n'
import { Input } from './Input'
import { signLabel } from './labels'
import { PhotoSheet } from './PhotoSheet'
import { photoUri } from './photos'
import { ReminderList } from './ReminderList'
import { Sheet } from './Sheet'
import { SnackbarHost } from './Snackbar'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'

/** Eintrag ansehen (Screens 3 und 4): Alter, Sternzeichen, Notiz, Bild und Erinnerungen. */
export function DetailScreen({ id, onClose, onDelete, onReminderAdded }: { id: string; onClose: () => void; onDelete: (id: string) => void; onReminderAdded: () => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const env = useEnv()
  const insets = useSafeAreaInsets()
  const store = useBirthdayStore()
  const { settings, people } = useSnapshot()
  const p = people.find((x) => x.id === id)
  const [note, setNote] = useState(p?.note ?? '')
  const [editOpen, setEditOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)
  const [groupOpen, setGroupOpen] = useState(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!p) onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!p])

  useEffect(() => () => clearTimeout(saveTimer.current), [])

  if (!p) return null

  const changeNote = (text: string) => {
    setNote(text)
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => store.update(p.id, { note: text }), 600)
  }
  const flushNote = () => {
    clearTimeout(saveTimer.current)
    if (note !== p.note) store.update(p.id, { note })
  }
  const close = () => {
    flushNote()
    onClose()
  }

  const next = nextBirthday(p, env.now, env.ctx)
  const group = settings.groups.find((g) => g.id === p.group)
  const groupName = useGroupName()
  const sign = signLabel(p.month, p.day, lang)
  const currentAge = next.window.age !== null ? next.window.age - (next.days === 0 ? 0 : 1) : null
  const birthWeekday = p.year !== null ? weekdayName({ y: p.year, m: p.month, d: p.day }, lang) : ''

  const setMode = (mode: ReminderMode) => {
    store.setReminders(p.id, mode)
    if (mode === 'custom') onReminderAdded()
  }

  const share = () => {
    setMenuOpen(false)
    Share.share({ message: t.shareText(p.name, p.year ? birthDate(p.day, p.month, p.year, env.style) : dayMonthLong({ d: p.day, m: p.month }, env.style)) }).catch(() => {})
  }

  return (
    <Modal visible animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        <View style={styles.bar}>
          <IconButton icon="arrow-back" label={t.back} onPress={close} />
          <View style={{ flex: 1 }} />
          <IconButton icon="edit" label={t.edit} onPress={() => setEditOpen(true)} />
          <IconButton icon="more-vert" label={t.more} onPress={() => setMenuOpen(true)} />
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 40 }}>
          <View style={styles.hero}>
            <Pressable onPress={() => setPhotoOpen(true)} accessibilityRole="button" accessibilityLabel={t.photo}>
              <Avatar id={p.id} name={p.name} photo={photoUri(p.photo)} size={84} />
              <View style={[styles.camera, { backgroundColor: c.accent, borderColor: c.bg }]}>
                <MaterialIcons name="photo-camera" size={15} color={c.onAccent} />
              </View>
            </Pressable>
            <Text style={[styles.name, { color: c.text, fontSize: f(25) }]} accessibilityRole="header">
              {p.name}
            </Text>
            <Text style={{ color: c.text2, fontSize: f(15), marginTop: 2 }}>{longDate(next.window.day, env.style)}</Text>
            <View style={[styles.big, { backgroundColor: c.accent }]}>
              <Text style={{ color: c.onAccent, fontWeight: '800', fontSize: f(16) }}>{t.inNDays(next.days)}</Text>
            </View>
            <Pressable
              onPress={() => setGroupOpen(true)}
              style={[styles.groupPill, { backgroundColor: c.card }]}
              android_ripple={{ color: c.ripple }}
              accessibilityRole="button"
              accessibilityLabel={`${t.group}: ${groupName(group)}`}
            >
              <GroupDot group={group} size={10} />
              <Text style={{ color: c.text, fontWeight: '600', fontSize: f(14) }} numberOfLines={1}>
                {groupName(group)}
              </Text>
              <MaterialIcons name="chevron-right" size={18} color={c.text3} style={{ marginRight: -4 }} />
            </Pressable>
          </View>

          <View style={styles.tiles}>
            <Tile label={t.age} value={currentAge !== null ? String(currentAge) : '–'} sub={next.window.age !== null && next.days > 0 ? t.turnsShort(next.window.age) : next.window.age !== null ? t.turnsToday(next.window.age) : t.noYear} />
            <Tile label={t.sign} value={sign.symbol} sub={sign.name} />
            <Tile label={t.born} value={p.year ? birthDate(p.day, p.month, p.year, env.style) : t.noYear} sub={t.bornOn(birthWeekday)} small />
          </View>

          <Label>{t.note}</Label>
          <View style={[styles.note, { backgroundColor: c.card }]}>
            <Input
              value={note}
              onChangeText={changeNote}
              onBlur={flushNote}
              multiline
              placeholder={t.notePlaceholder}
              placeholderTextColor={c.text3}
              cursorColor={c.accentText}
              style={{ color: c.text, fontSize: f(15.5), lineHeight: f(22), minHeight: 48, textAlignVertical: 'top' }}
              accessibilityLabel={t.note}
            />
          </View>

          <Label>{t.reminders}</Label>
          <Segmented
            options={[
              ['standard', t.modeStandard],
              ['custom', t.modeCustom],
              ['none', t.modeNone],
            ]}
            value={p.mode}
            onChange={setMode}
          />
          <View style={{ height: 8 }} />
          {p.mode === 'none' ? (
            <Hint>{t.noneHint}</Hint>
          ) : p.mode === 'standard' ? (
            <>
              <ReminderList reminders={settings.defaults} readOnly />
              <Hint>{t.standardHint}</Hint>
            </>
          ) : (
            <ReminderList
              reminders={p.reminders}
              person={p}
              onChange={(list) => {
                store.update(p.id, { reminders: list })
                onReminderAdded()
              }}
            />
          )}
        </ScrollView>
        <SnackbarHost bottom={insets.bottom + 16} />
      </KeyboardAvoidingView>

      <EditSheet open={editOpen} id={p.id} onClose={() => setEditOpen(false)} />
      <PhotoSheet open={photoOpen} person={p} onClose={() => setPhotoOpen(false)} />
      <GroupPicker open={groupOpen} value={p.group} onPick={(g) => store.setGroup(p.id, g)} onClose={() => setGroupOpen(false)} />
      <Sheet open={menuOpen} title={p.name} onClose={() => setMenuOpen(false)}>
        <Card>
          <Row icon="share" label={t.share} onPress={share} />
          <Row
            icon="delete-outline"
            label={t.deleteEntry}
            danger
            last
            onPress={() => {
              setMenuOpen(false)
              onClose()
              onDelete(p.id)
            }}
          />
        </Card>
      </Sheet>
    </Modal>
  )
}

function Tile({ label, value, sub, small }: { label: string; value: string; sub: string; small?: boolean }) {
  const c = useColors()
  const f = useFont()
  return (
    <View style={[styles.tile, { backgroundColor: c.card }]} accessible accessibilityLabel={`${label}: ${value} ${sub}`}>
      <Text style={{ color: c.text3, fontSize: f(10.5), fontWeight: '700', letterSpacing: 0.5 }} numberOfLines={1}>
        {label}
      </Text>
      <Text style={{ color: c.text, fontSize: f(small ? 15 : 19), fontWeight: '800', marginTop: 4 }} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {!!sub && (
        <Text style={{ color: c.text2, fontSize: f(12), marginTop: 2 }} numberOfLines={1}>
          {sub}
        </Text>
      )}
    </View>
  )
}

function IconButton({ icon, label, onPress }: { icon: keyof typeof MaterialIcons.glyphMap; label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable onPress={onPress} style={styles.iconButton} android_ripple={{ color: c.ripple, borderless: true, radius: 22 }} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialIcons name={icon} size={24} color={c.text} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, height: 56 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', paddingBottom: 14 },
  camera: { position: 'absolute', right: -4, bottom: -2, width: 32, height: 32, borderRadius: 16, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '800', marginTop: 10, textAlign: 'center' },
  big: { marginTop: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 5 },
  groupPill: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10, borderRadius: 16, paddingLeft: 12, paddingRight: 10, minHeight: 34, overflow: 'hidden', maxWidth: '80%' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  note: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 },
})
