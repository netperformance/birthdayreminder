import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import type { ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Switch, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { haptic } from './haptics'
import { avatarColor, useColors, useFont } from './theme'

export type IconName = keyof typeof MaterialIcons.glyphMap

/** Überschrift in Großbuchstaben über einem Block ("NOTIZ", "ERINNERUNGEN"). */
export function Label({ children, right, first }: { children: string; right?: ReactNode; first?: boolean }) {
  const c = useColors()
  const f = useFont()
  return (
    <View style={[styles.labelRow, first && { marginTop: 4 }]}>
      <Text style={[styles.label, { color: c.text2, fontSize: f(12) }]}>{children}</Text>
      {right}
    </View>
  )
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors()
  return <View style={[styles.card, { backgroundColor: c.card }, style]}>{children}</View>
}

/** Zeile in einer Karte: Symbol, Text, optional Untertitel und etwas rechts. */
export function Row({
  lead,
  icon,
  iconColor,
  label,
  sub,
  subColor,
  right,
  chevron,
  danger,
  accent,
  last,
  onPress,
  disabled,
  a11y,
}: {
  /** Etwas vor dem Text statt eines Symbols, z. B. der Punkt einer Gruppe. */
  lead?: ReactNode
  icon?: IconName
  iconColor?: string
  label: string
  sub?: string
  subColor?: string
  right?: ReactNode
  chevron?: boolean
  danger?: boolean
  /** Text in Rosa, z. B. "Erinnerung hinzufügen". */
  accent?: boolean
  last?: boolean
  onPress?: () => void
  disabled?: boolean
  a11y?: string
}) {
  const c = useColors()
  const f = useFont()
  const color = danger ? c.danger : accent ? c.accentText : c.text
  const body = (
    <>
      {lead}
      {icon && <MaterialIcons name={icon} size={22} color={iconColor ?? (danger ? c.danger : c.accentText)} />}
      <View style={styles.rowText}>
        <Text style={{ fontSize: f(16), color, fontWeight: accent ? '600' : '400' }} numberOfLines={2}>
          {label}
        </Text>
        {!!sub && (
          <Text style={{ fontSize: f(13), color: subColor ?? c.text2, marginTop: 2 }} numberOfLines={3}>
            {sub}
          </Text>
        )}
      </View>
      {right}
      {chevron && <MaterialIcons name="chevron-right" size={22} color={c.text3} style={{ marginRight: -6 }} />}
    </>
  )
  const style = [styles.row, { opacity: disabled ? 0.45 : 1 }, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep }]
  if (!onPress) return <View style={style}>{body}</View>
  return (
    <Pressable onPress={onPress} disabled={disabled} android_ripple={{ color: c.ripple }} style={style} accessibilityRole="button" accessibilityLabel={a11y}>
      {body}
    </Pressable>
  )
}

/** Auswahl aus wenigen Möglichkeiten nebeneinander, die gewählte in Pastellrosa. */
export function Segmented<T extends string | boolean>({
  options,
  value,
  onChange,
  compact,
}: {
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (v: T) => void
  compact?: boolean
}) {
  const c = useColors()
  const f = useFont()
  return (
    <View style={[styles.segmented, { backgroundColor: c.card }]} accessibilityRole="radiogroup">
      {options.map(([v, text]) => {
        const active = value === v
        return (
          <Pressable
            key={String(v)}
            onPress={() => {
              if (!active) haptic('tick')
              onChange(v)
            }}
            style={[styles.segment, compact && { minHeight: 34 }, active && { backgroundColor: c.accent }]}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
          >
            <Text style={{ color: active ? c.onAccent : c.text2, fontWeight: '600', fontSize: f(15) }} numberOfLines={1}>
              {text}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const c = useColors()
  return (
    <Switch
      value={value}
      disabled={disabled}
      onValueChange={(v) => {
        haptic('tick')
        onChange(v)
      }}
      trackColor={{ false: c.dark ? '#4a4447' : '#d6d1d4', true: c.switchOn }}
      thumbColor="#ffffff"
    />
  )
}

/** Chip zum Antippen, gewählt in Pastellrosa mit Haken. */
export function Chip({ label, active, onPress, icon, outlined }: { label: string; active?: boolean; onPress: () => void; icon?: IconName; outlined?: boolean }) {
  const c = useColors()
  const f = useFont()
  return (
    <Pressable
      onPress={() => {
        haptic('tick')
        onPress()
      }}
      style={[styles.chip, { backgroundColor: active ? c.accent : c.card }, outlined && { borderWidth: 2, borderColor: c.accentText }]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: !!active }}
    >
      {(active || icon) && <MaterialIcons name={active ? 'check' : icon!} size={16} color={active ? c.onAccent : c.text} />}
      <Text style={{ color: active ? c.onAccent : c.text, fontWeight: '600', fontSize: f(14) }} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Button({ label, onPress, disabled, kind = 'primary', icon }: { label: string; onPress: () => void; disabled?: boolean; kind?: 'primary' | 'plain'; icon?: IconName }) {
  const c = useColors()
  const f = useFont()
  const primary = kind === 'primary'
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      android_ripple={{ color: c.ripple }}
      style={[styles.button, { backgroundColor: primary ? c.accent : c.card, opacity: disabled ? 0.5 : 1 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      {icon && <MaterialIcons name={icon} size={20} color={primary ? c.onAccent : c.accentText} />}
      <Text style={{ color: primary ? c.onAccent : c.accentText, fontWeight: '700', fontSize: f(16) }}>{label}</Text>
    </Pressable>
  )
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase())
    .join('')
}

/** Runder Kreis mit Bild oder Anfangsbuchstaben. */
export function Avatar({ id, name, photo, size = 42 }: { id: string; name: string; photo?: string | null; size?: number }) {
  const f = useFont()
  if (photo) return <Image source={{ uri: photo }} style={{ width: size, height: size, borderRadius: size / 2 }} accessibilityIgnoresInvertColors />
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(id) }]}>
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: f(size * 0.36) }} allowFontScaling={false}>
        {initials(name)}
      </Text>
    </View>
  )
}

/** Kleiner Hinweistext unter einem Block. */
export function Hint({ children, color }: { children: ReactNode; color?: string }) {
  const c = useColors()
  const f = useFont()
  return <Text style={[styles.hint, { color: color ?? c.text2, fontSize: f(13) }]}>{children}</Text>
}

export const styles = StyleSheet.create({
  labelRow: { flexDirection: 'row', alignItems: 'center', marginTop: 18, marginBottom: 8, marginLeft: 4 },
  label: { fontWeight: '700', letterSpacing: 0.6, flex: 1 },
  card: { borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 54, paddingHorizontal: 16, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: 14, gap: 3 },
  segment: { flex: 1, minHeight: 40, paddingHorizontal: 4, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 38, paddingHorizontal: 14, borderRadius: 19 },
  button: { flexDirection: 'row', gap: 8, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  hint: { marginTop: 8, marginHorizontal: 4, lineHeight: 18 },
})
