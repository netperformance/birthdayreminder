import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useRef, useState } from 'react'
import { Alert, Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { COLOR_KEYS, GROUP_COLORS, NO_GROUP, type ColorKey, type Group } from '../domain/model'
import { Card, Hint, Label } from './controls'
import { haptic } from './haptics'
import { useT } from './i18n'
import { Input } from './Input'
import { Sheet } from './Sheet'
import { useSnackbar } from './Snackbar'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'

/** Farbiger Punkt einer Gruppe. "Ohne Gruppe" ist ein leerer Ring. */
export function GroupDot({ group, size = 14 }: { group: Group | null | undefined; size?: number }) {
  const c = useColors()
  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        group && group.id !== NO_GROUP ? { backgroundColor: GROUP_COLORS[group.color] } : { borderWidth: 2, borderColor: c.text3 },
      ]}
    />
  )
}

/** Name einer Gruppe zum Anzeigen. "Ohne Gruppe" heißt je nach Sprache der App anders. */
export function useGroupName(): (g: Group | null | undefined) => string {
  const t = useT()
  return (g) => (!g || g.id === NO_GROUP ? t.noGroup : g.name)
}

/** Für eine neue Gruppe die erste Farbe, die noch keine andere Gruppe hat. */
function unusedColor(used: ColorKey[]): ColorKey {
  const order: ColorKey[] = ['red', 'blue', 'teal', 'violet', 'orange', 'green', 'pink', 'amber', 'indigo', 'lime', 'brown', 'gray']
  return order.find((k) => !used.includes(k)) ?? 'blue'
}

/**
 * Gruppe auswählen (Screen G4). Ein Tipp wählt und schließt. "Neue Gruppe" legt eine an
 * und wählt sie gleich aus.
 */
export function GroupPicker({ open, value, onPick, onClose }: { open: boolean; value: string | null; onPick: (id: string) => void; onClose: () => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const groupName = useGroupName()
  const { settings } = useSnapshot()
  const [editorOpen, setEditorOpen] = useState(false)
  const current = settings.groups.some((g) => g.id === value) ? value : NO_GROUP

  const pick = (id: string) => {
    haptic('tick')
    onPick(id)
    onClose()
  }

  const row = (id: string, group: Group, label: string, last: boolean) => (
    <Pressable
      key={id}
      onPress={() => pick(id)}
      android_ripple={{ color: c.ripple }}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: current === id }}
    >
      <GroupDot group={group} />
      <Text style={{ flex: 1, color: c.text, fontSize: f(16) }} numberOfLines={1}>
        {label}
      </Text>
      {current === id && <MaterialIcons name="check" size={22} color={c.accentText} />}
    </Pressable>
  )

  return (
    <Sheet open={open} title={t.group} onClose={onClose}>
      <Card style={{ marginTop: 4 }}>
        {settings.groups.map((g, i) => row(g.id, g, groupName(g), i === settings.groups.length - 1))}
      </Card>
      <Card style={{ marginTop: 12 }}>
        <Pressable onPress={() => setEditorOpen(true)} android_ripple={{ color: c.ripple }} style={styles.row} accessibilityRole="button">
          <MaterialIcons name="add" size={22} color={c.accentText} />
          <Text style={{ color: c.accentText, fontWeight: '600', fontSize: f(16) }}>{t.newGroup}</Text>
        </Pressable>
      </Card>
      {settings.groups.length <= 1 && <Hint>{t.groupsEmpty}</Hint>}
      <GroupEditor
        open={editorOpen}
        id={null}
        onClose={() => setEditorOpen(false)}
        onCreated={(g) => {
          setEditorOpen(false)
          pick(g.id)
        }}
      />
    </Sheet>
  )
}

/** Gruppe anlegen oder bearbeiten (Screen G6): Name, Farbe, Löschen. */
export function GroupEditor({ open, id, onClose, onCreated }: { open: boolean; id: string | null; onClose: () => void; onCreated?: (g: Group) => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const groupName = useGroupName()
  const store = useBirthdayStore()
  const { settings, people } = useSnapshot()
  const snack = useSnackbar()
  // "Ohne Gruppe" ist fest und lässt sich hier nicht bearbeiten.
  const current = id && id !== NO_GROUP ? settings.groups.find((g) => g.id === id) : undefined
  const [name, setName] = useState('')
  const [color, setColor] = useState<ColorKey>('red')

  useEffect(() => {
    if (!open) return
    setName(current?.name ?? '')
    setColor(current?.color ?? unusedColor(settings.groups.map((g) => g.color)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id])

  const duplicate = name.trim() ? store.findGroupByName(name, id ?? undefined) : undefined
  const canSave = !!name.trim() && !duplicate

  const save = () => {
    if (!canSave) return
    if (current) {
      store.updateGroup(current.id, { name, color })
      onClose()
      return
    }
    const g = store.createGroup(name, color)
    if (!g) return
    haptic('success')
    snack({ message: t.groupCreated(g.name) })
    if (onCreated) onCreated(g)
    else onClose()
  }

  const confirmDelete = () => {
    if (!current) return
    const count = people.filter((p) => p.group === current.id).length
    Alert.alert(t.deleteGroupTitle(current.name), t.deleteGroupText(count), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.delete,
        style: 'destructive',
        onPress: () => {
          const undo = store.removeGroup(current.id)
          if (!undo) return
          haptic('press')
          onClose()
          snack({ message: t.groupDeleted(current.name), action: { label: t.undo, run: () => store.restoreGroup(undo) } })
        },
      },
    ])
  }

  return (
    <Sheet
      open={open}
      title={current ? current.name : t.newGroup}
      onClose={onClose}
      left={{ label: t.cancel, onPress: onClose }}
      right={{ label: current ? t.done : t.create, onPress: save, disabled: !canSave }}
    >
      <Label first>{t.name}</Label>
      <View style={[styles.field, { backgroundColor: c.card }]}>
        <View style={[styles.dot, { backgroundColor: GROUP_COLORS[color] }]} />
        <Input
          style={[styles.input, { color: c.text, fontSize: f(17) }]}
          value={name}
          onChangeText={setName}
          placeholder={t.groupPlaceholder}
          placeholderTextColor={c.text3}
          cursorColor={c.accentText}
          autoFocus={!id}
          autoCapitalize="sentences"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={save}
          maxLength={30}
          accessibilityLabel={t.name}
        />
      </View>
      {duplicate && <Hint color={c.danger}>{t.groupExists(groupName(duplicate))}</Hint>}

      <Label>{t.color}</Label>
      <View style={[styles.colors, { backgroundColor: c.card }]} accessibilityRole="radiogroup">
        {COLOR_KEYS.map((key) => {
          const active = key === color
          return (
            <Pressable
              key={key}
              onPress={() => {
                setColor(key)
                haptic('tick')
              }}
              style={styles.cell}
              accessibilityRole="radio"
              accessibilityLabel={t.colors[key]}
              accessibilityState={{ checked: active }}
            >
              <View style={[styles.ring, active && { borderColor: GROUP_COLORS[key] }]}>
                <View style={[styles.swatch, { backgroundColor: GROUP_COLORS[key] }]}>{active && <MaterialIcons name="check" size={20} color="#fff" />}</View>
              </View>
            </Pressable>
          )
        })}
      </View>

      {current && (
        <Pressable style={[styles.delete, { backgroundColor: c.card }]} android_ripple={{ color: c.ripple }} onPress={confirmDelete} accessibilityRole="button">
          <MaterialIcons name="delete-outline" size={22} color={c.danger} />
          <Text style={{ color: c.danger, fontSize: f(16), fontWeight: '500' }}>{t.deleteGroup}</Text>
        </Pressable>
      )}
    </Sheet>
  )
}

const ROW_H = 54

/** Gruppen in den Einstellungen (Screen G5): antippen zum Bearbeiten, am Griff ziehen zum Umsortieren. Aus My Notes übernommen. */
export function GroupOrder({ groups, onChange, onDragChange, onEdit }: { groups: Group[]; onChange: (order: string[]) => void; onDragChange: (dragging: boolean) => void; onEdit: (id: string) => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const groupName = useGroupName()
  const order = groups.map((x) => x.id)
  const byId = new Map(groups.map((x) => [x.id, x]))
  const [local, setLocal] = useState(order)
  const [dragId, setDragId] = useState<string | null>(null)
  const offset = useRef(new Animated.Value(0)).current
  const state = useRef({ local: order, dragId: null as string | null, startIndex: 0, index: 0 })
  state.current.local = local
  const callbacks = useRef({ onChange, onDragChange })
  callbacks.current = { onChange, onDragChange }

  const key = order.join('|')
  useEffect(() => {
    if (!state.current.dragId) setLocal(order)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  const responders = useRef(new Map<string, ReturnType<typeof PanResponder.create>>()).current
  const finish = () => {
    const s = state.current
    s.dragId = null
    offset.setValue(0)
    setDragId(null)
    callbacks.current.onDragChange(false)
    callbacks.current.onChange(s.local)
  }
  const responderFor = (id: string) => {
    let r = responders.get(id)
    if (r) return r
    r = PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        const index = state.current.local.indexOf(id)
        state.current = { ...state.current, dragId: id, startIndex: index, index }
        offset.setValue(0)
        setDragId(id)
        callbacks.current.onDragChange(true)
        haptic('press')
      },
      onPanResponderMove: (_e, g) => {
        const s = state.current
        const target = Math.max(0, Math.min(s.local.length - 1, s.startIndex + Math.round(g.dy / ROW_H)))
        if (target !== s.index) {
          const next = s.local.filter((x) => x !== id)
          next.splice(target, 0, id)
          s.index = target
          s.local = next
          setLocal(next)
          haptic('tick')
        }
        offset.setValue(g.dy - (s.index - s.startIndex) * ROW_H)
      },
      onPanResponderRelease: () => finish(),
      onPanResponderTerminate: () => finish(),
    })
    responders.set(id, r)
    return r
  }

  const visible = local.filter((id) => byId.has(id))
  return (
    <View style={[styles.card, { backgroundColor: c.card, overflow: 'visible' }]}>
      {visible.map((id, i) => {
        const g = byId.get(id)!
        const lifted = dragId === id
        return (
          <Animated.View
            key={id}
            style={[
              styles.orderRow,
              { backgroundColor: c.card },
              i < visible.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep },
              lifted && { zIndex: 2, elevation: 8, borderRadius: 12, transform: [{ translateY: offset }, { scale: 1.02 }] },
              i === 0 && { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
              i === visible.length - 1 && { borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
            ]}
          >
            {id === NO_GROUP ? (
              <View style={styles.orderLabel}>
                <GroupDot group={g} />
                <Text style={{ flex: 1, fontSize: f(16), color: c.text }} numberOfLines={1}>
                  {groupName(g)}
                </Text>
                <MaterialIcons name="lock-outline" size={18} color={c.text3} accessibilityLabel={t.groupFixed} />
              </View>
            ) : (
              <Pressable style={styles.orderLabel} onPress={() => onEdit(id)} android_ripple={{ color: c.ripple }} accessibilityRole="button" accessibilityLabel={t.editNamed(g.name)}>
                <GroupDot group={g} />
                <Text style={{ flex: 1, fontSize: f(16), color: c.text }} numberOfLines={1}>
                  {g.name}
                </Text>
              </Pressable>
            )}
            <View {...responderFor(id).panHandlers} style={styles.grip} accessibilityLabel={t.moveNamed(groupName(g))}>
              <MaterialIcons name="drag-handle" size={24} color={c.text3} />
            </View>
          </Animated.View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, borderRadius: 14, paddingHorizontal: 16 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  input: { flex: 1, paddingVertical: 10 },
  colors: { flexDirection: 'row', flexWrap: 'wrap', padding: 8, borderRadius: 16 },
  cell: { width: '16.66%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 2.5, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  delete: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 16, borderRadius: 14, marginTop: 24, overflow: 'hidden' },
  card: { borderRadius: 16 },
  orderRow: { flexDirection: 'row', alignItems: 'center', height: ROW_H },
  orderLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, height: ROW_H, paddingLeft: 16 },
  grip: { width: 56, height: ROW_H, alignItems: 'center', justifyContent: 'center' },
})
