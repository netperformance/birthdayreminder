import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { time } from '../domain/format'
import { sortReminders, type Person, type Reminder } from '../domain/model'
import { Card, Row } from './controls'
import { useEnv } from './env'
import { useT } from './i18n'
import { ReminderSheet, type ReminderResult } from './ReminderSheet'
import { useColors, useFont } from './theme'

/** Liste von Erinnerungen mit "Erinnerung hinzufügen". Grau und ohne Antippen, wenn `readOnly`. */
export function ReminderList({
  reminders,
  person,
  readOnly,
  onChange,
}: {
  reminders: Reminder[]
  person?: Person
  readOnly?: boolean
  onChange?: (list: Reminder[]) => void
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const env = useEnv()
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [adding, setAdding] = useState(false)
  const list = sortReminders(reminders)

  const apply = ({ updated, added }: ReminderResult) => {
    const next = reminders.map((r) => (updated && r.id === updated.id ? updated : r))
    onChange?.([...next, ...added])
  }

  return (
    <>
      <Card style={readOnly ? { opacity: 0.6 } : undefined}>
        {list.map((r, i) => {
          const tags = [r.popup ? t.popup : null, r.fullscreen ? t.fullscreen : null].filter(Boolean) as string[]
          const content = (
            <View style={[styles.row, (i < list.length - 1 || !readOnly) && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep }]}>
              <View style={[styles.icon, { backgroundColor: c.accentSoft }]}>
                <MaterialIcons name="notifications" size={17} color={c.accentText} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: c.text, fontWeight: '600', fontSize: f(15.5) }}>
                  {t.offsetLabel(r.offset)} · {time(r.minute, env.style)}
                </Text>
                <View style={styles.tags}>
                  {tags.map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: c.accentSoft }]}>
                      <MaterialIcons name={tag === t.popup ? 'smartphone' : 'fullscreen'} size={12} color={c.accentDeep} />
                      <Text style={{ color: c.accentDeep, fontWeight: '700', fontSize: f(11.5) }}>{tag}</Text>
                    </View>
                  ))}
                  {!!r.hint && (
                    <Text style={{ color: c.text2, fontSize: f(12.5) }} numberOfLines={1}>
                      „{r.hint}“
                    </Text>
                  )}
                </View>
              </View>
              {!readOnly && <MaterialIcons name="chevron-right" size={20} color={c.text3} />}
            </View>
          )
          return readOnly ? (
            <View key={r.id}>{content}</View>
          ) : (
            <Pressable key={r.id} onPress={() => setEditing(r)} android_ripple={{ color: c.ripple }} accessibilityRole="button">
              {content}
            </Pressable>
          )
        })}
        {!readOnly && <Row icon="add" label={t.addReminder} accent last onPress={() => setAdding(true)} />}
      </Card>
      {!readOnly && (
        <ReminderSheet
          open={adding || !!editing}
          person={person}
          existing={editing ?? undefined}
          onSubmit={apply}
          onDelete={editing ? () => onChange?.(reminders.filter((r) => r.id !== editing.id)) : undefined}
          onClose={() => {
            setAdding(false)
            setEditing(null)
          }}
        />
      )}
    </>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10, minHeight: 58 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, marginTop: 3 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
})
