import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { alarms } from '../../modules/birthday-alarms'
import { normalize } from '../domain/normalize'
import { zoneCity } from '../domain/zone'
import { Card, Row } from './controls'
import { useEnv } from './env'
import { useLang, useT } from './i18n'
import { Input } from './Input'
import { hoursText, placeTitle } from './labels'
import { Sheet } from './Sheet'
import { useColors, useFont } from './theme'

/** Auswahl einer Zeitzone über den Ort ("Sydney", "Los Angeles"). */
export function ZonePicker({
  open,
  value,
  allowHome,
  onPick,
  onClose,
}: {
  open: boolean
  value: string | null
  /** Erste Zeile "Wie Zuhause" (für einen Eintrag). */
  allowHome?: boolean
  onPick: (zone: string | null) => void
  onClose: () => void
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const env = useEnv()
  const [query, setQuery] = useState('')
  const zones = useMemo(() => (open ? alarms.zones() : []), [open])

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const q = normalize(query)
  const shown = zones.filter((z) => !q || normalize(z.replaceAll('_', ' ')).includes(q)).slice(0, 60)
  const offset = (z: string) => {
    const m = env.ctx.info.offsetMinutes(z, env.now)
    return `UTC${m >= 0 ? '+' : '−'}${hoursText(m, lang)}`
  }

  return (
    <Sheet open={open} title={t.pickZone} onClose={onClose} fullHeight>
      <View style={[styles.search, { backgroundColor: c.card }]}>
        <MaterialIcons name="search" size={20} color={c.text3} />
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder={t.zoneSearch}
          placeholderTextColor={c.text3}
          cursorColor={c.accentText}
          style={{ flex: 1, color: c.text, fontSize: f(16), paddingVertical: 10 }}
          autoCorrect={false}
          accessibilityLabel={t.zoneSearch}
        />
      </View>
      <Card style={{ marginTop: 12 }}>
        {allowHome && !q && (
          <Row
            icon="home"
            label={t.zoneHome}
            sub={placeTitle(env.ctx.homeZone, lang)}
            right={value === null ? <MaterialIcons name="check" size={20} color={c.accentText} /> : undefined}
            onPress={() => onPick(null)}
            last={shown.length === 0}
          />
        )}
        {shown.map((z, i) => (
          <Row
            key={z}
            label={zoneCity(z)}
            sub={`${z.split('/')[0].replaceAll('_', ' ')} · ${offset(z)}`}
            right={value === z ? <MaterialIcons name="check" size={20} color={c.accentText} /> : undefined}
            onPress={() => onPick(z)}
            last={i === shown.length - 1}
          />
        ))}
      </Card>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14 },
})
