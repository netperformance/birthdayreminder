import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { memo, useRef } from 'react'
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { Avatar } from './controls'
import { haptic } from './haptics'
import { useT } from './i18n'
import { useColors, useFont } from './theme'

interface Props {
  id: string
  name: string
  photo: string | null
  sign: string
  /** Farbe der Gruppe als Punkt hinter dem Namen, oder null. */
  groupColor?: string | null
  sub: string
  /** Text rechts ("Morgen", "8 Tage"), oder null. */
  badge: string | null
  /** Badge in Rosa (bald) oder grau. */
  soon: boolean
  hasNote: boolean
  noReminder: boolean
  /** Notiztext mit markiertem Treffer (Suche). */
  extra?: React.ReactNode
  last: boolean
  onOpen: (id: string) => void
  onDelete?: (id: string) => void
  onSwipeStart?: () => void
  onSwipeEnd?: () => void
}

const DELETE_SHARE = 0.35

/** Ein Eintrag in der Liste. Tippen öffnet, nach links wischen löscht (mit Rückgängig). */
export const PersonRow = memo(function PersonRow(props: Props) {
  const { id, name, photo, sign, groupColor, sub, badge, soon, hasNote, noReminder, extra, last, onOpen } = props
  const c = useColors()
  const t = useT()
  const f = useFont()
  const x = useRef(new Animated.Value(0)).current
  const width = useRef(360)
  const latest = useRef(props)
  latest.current = props

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => !!latest.current.onDelete && g.dx < -10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => latest.current.onSwipeStart?.(),
      onPanResponderMove: (_e, g) => x.setValue(Math.min(0, g.dx)),
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: (_e, g) => {
        latest.current.onSwipeEnd?.()
        if (-g.dx > width.current * DELETE_SHARE || g.vx < -1.2) {
          haptic('press')
          Animated.timing(x, { toValue: -width.current, duration: 160, useNativeDriver: true }).start(() => {
            latest.current.onDelete?.(latest.current.id)
            x.setValue(0)
          })
        } else {
          Animated.spring(x, { toValue: 0, useNativeDriver: true, damping: 20, stiffness: 260 }).start()
        }
      },
      onPanResponderTerminate: () => {
        latest.current.onSwipeEnd?.()
        Animated.spring(x, { toValue: 0, useNativeDriver: true }).start()
      },
    }),
  ).current

  return (
    <View style={styles.wrap} onLayout={(e) => (width.current = e.nativeEvent.layout.width)}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.delete, { backgroundColor: c.danger, opacity: x.interpolate({ inputRange: [-2, 0], outputRange: [1, 0], extrapolate: 'clamp' }) }]}>
        <MaterialIcons name="delete-outline" size={22} color="#fff" />
        <Text style={[styles.deleteText, { fontSize: f(15) }]}>{t.delete}</Text>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX: x }], backgroundColor: c.card }} {...pan.panHandlers}>
        <Pressable
          onPress={() => onOpen(id)}
          android_ripple={{ color: c.ripple }}
          style={[styles.row, !!extra && { alignItems: 'flex-start' }]}
          accessibilityRole="button"
          accessibilityLabel={[name, sub, badge, hasNote ? t.hasNote : '', noReminder ? t.noReminder : ''].filter(Boolean).join(', ')}
          accessibilityHint={props.onDelete ? t.rowHint : undefined}
        >
          <Avatar id={id} name={name} photo={photo} size={42} />
          <View style={styles.main}>
            <View style={styles.nameLine}>
              <Text style={[styles.name, { color: c.text, fontSize: f(16) }]} numberOfLines={1}>
                {name}
              </Text>
              {!!groupColor && <View style={[styles.dot, { backgroundColor: groupColor }]} />}
              {!!sign && <Text style={{ color: c.text3, fontSize: f(15) }}>{sign}</Text>}
            </View>
            <Text style={{ color: c.text2, fontSize: f(13.5), marginTop: 2 }} numberOfLines={1}>
              {sub}
            </Text>
            {extra}
          </View>
          <View style={styles.right}>
            {badge && (
              <View style={[styles.badge, { backgroundColor: soon ? c.accentSoft : c.gray }]}>
                <Text style={{ color: soon ? c.accentDeep : c.text2, fontWeight: '700', fontSize: f(12.5) }}>{badge}</Text>
              </View>
            )}
            {(hasNote || noReminder) && (
              <View style={styles.icons}>
                {hasNote && <MaterialIcons name="sticky-note-2" size={15} color={c.text3} />}
                {noReminder && <MaterialIcons name="notifications-off" size={15} color={c.text3} />}
              </View>
            )}
          </View>
        </Pressable>
      </Animated.View>
      {!last && <View style={[styles.sep, { backgroundColor: c.sep }]} />}
    </View>
  )
})

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  delete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 22, gap: 6 },
  deleteText: { color: '#fff', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, paddingLeft: 12, paddingRight: 12, paddingVertical: 10 },
  main: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontWeight: '600', flexShrink: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  right: { alignItems: 'flex-end', gap: 5 },
  badge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  icons: { flexDirection: 'row', gap: 4, paddingRight: 4 },
  sep: { position: 'absolute', left: 66, right: 0, bottom: 0, height: StyleSheet.hairlineWidth },
})
