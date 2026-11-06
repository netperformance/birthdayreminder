import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useMemo, useRef, useState } from 'react'
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, View, type TextInputInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { monthName } from '../domain/format'
import { effectiveReminders } from '../domain/model'
import { normalize } from '../domain/normalize'
import { nextBirthday } from '../domain/schedule'
import { useEnv } from './env'
import { useLang, useT } from './i18n'
import { Input } from './Input'
import { shortDate, signLabel } from './labels'
import { PersonRow } from './PersonRow'
import { photoUri } from './photos'
import { useColors, useFont } from './theme'
import { useSnapshot } from './useStore'

/** Findet Stellen eines Suchbegriffs ohne Rücksicht auf Groß und Klein und Umlaute. */
function findRanges(text: string, query: string): [number, number][] {
  const q = normalize(query)
  if (!q) return []
  // Zeichenweise vergleichen, damit die Positionen im Originaltext stimmen.
  const chars = [...text]
  const norm = chars.map((ch) => normalize(ch) || ch)
  const out: [number, number][] = []
  for (let i = 0; i < chars.length; i++) {
    let joined = ''
    for (let j = i; j < chars.length && joined.length < q.length; j++) {
      joined += norm[j]
      if (joined === q) {
        out.push([i, j + 1])
        i = j
        break
      }
      if (!q.startsWith(joined)) break
    }
  }
  return out
}

/** Suche in Namen und Notizen (Screen 6). Ein Monatsname zeigt alle Geburtstage in diesem Monat. */
export function SearchScreen({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: (id: string) => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const env = useEnv()
  const insets = useSafeAreaInsets()
  const { people, settings } = useSnapshot()
  const [query, setQuery] = useState('')
  const inputRef = useRef<TextInputInstance>(null)

  const results = useMemo(() => {
    const q = normalize(query)
    if (!q) return []
    const month = q.length >= 3 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((m) => normalize(monthName(m, lang)).startsWith(q)) : undefined
    return people
      .map((p) => {
        const inName = normalize(p.name).includes(q)
        const noteHit = findRanges(p.note, query)
        const byMonth = month !== undefined && p.month === month
        if (!inName && noteHit.length === 0 && !byMonth) return null
        return { p, noteHit, next: nextBirthday(p, env.now, env.ctx) }
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => a.next.window.start - b.next.window.start)
  }, [people, query, lang, env.now, env.ctx])

  const close = () => {
    setQuery('')
    onClose()
  }

  if (!open) return null

  const snippet = (text: string, ranges: [number, number][]) => {
    const chars = [...text.replace(/\s+/g, ' ')]
    const [s] = ranges[0]
    const from = Math.max(0, s - 24)
    const parts: React.ReactNode[] = [from > 0 ? '… ' : '']
    let at = from
    for (const [a, b] of ranges) {
      if (a < from) continue
      parts.push(chars.slice(at, a).join(''))
      parts.push(
        <Text key={a} style={{ backgroundColor: c.mark, color: c.text }}>
          {chars.slice(a, b).join('')}
        </Text>,
      )
      at = b
    }
    parts.push(chars.slice(at).join(''))
    return (
      <Text style={{ color: c.text2, fontSize: f(13.5), marginTop: 3 }} numberOfLines={2}>
        {parts}
      </Text>
    )
  }

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={close}
      // autoFocus reicht in einem Modal unter Android nicht: Das Feld ist dann zwar aktiv, die Tastatur bleibt aber zu.
      // Erst wenn das Fenster sichtbar ist, öffnet focus() die Tastatur.
      onShow={() => {
        setTimeout(() => inputRef.current?.focus(), 100)
      }}
    >
      <KeyboardAvoidingView behavior="padding" style={[styles.fill, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
        <View style={styles.bar}>
          <Pressable onPress={close} style={styles.back} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.back}>
            <MaterialIcons name="arrow-back" size={24} color={c.text} />
          </Pressable>
          <View style={[styles.field, { backgroundColor: c.card, borderColor: c.accentText }]}>
            <Input
              ref={inputRef}
              value={query}
              onChangeText={setQuery}
              placeholder={t.search}
              placeholderTextColor={c.text3}
              cursorColor={c.accentText}
              style={{ flex: 1, color: c.text, fontSize: f(16), paddingVertical: 10 }}
              returnKeyType="search"
              accessibilityLabel={t.search}
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel={t.clearSearch}>
                <MaterialIcons name="cancel" size={20} color={c.text3} />
              </Pressable>
            )}
          </View>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {!!query.trim() && (
            <Text style={[styles.count, { color: c.text2, fontSize: f(12) }]}>{results.length ? t.hits(results.length).toLocaleUpperCase() : t.noResults}</Text>
          )}
          {results.length > 0 && (
            <View style={[styles.group, { backgroundColor: c.card }]}>
              {results.map(({ p, noteHit, next }, i) => (
                <PersonRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  photo={photoUri(p.photo)}
                  sign={signLabel(p.month, p.day, lang).symbol}
                  sub={[next.days === 0 ? t.today : shortDate(next.window.day, env.style), next.window.age !== null ? (next.days === 0 ? t.turned(next.window.age) : t.turns(next.window.age)) : null].filter(Boolean).join(' · ')}
                  badge={next.days === 0 ? t.today : next.days === 1 ? t.tomorrow : t.inDays(next.days)}
                  soon={next.days <= 14}
                  hasNote={false}
                  noReminder={effectiveReminders(p, settings).length === 0}
                  extra={noteHit.length ? snippet(p.note, noteHit) : undefined}
                  last={i === results.length - 1}
                  onOpen={(id) => {
                    close()
                    onOpen(id)
                  }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingBottom: 10 },
  back: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  field: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 24, paddingHorizontal: 16, borderWidth: 1.5 },
  count: { fontWeight: '700', letterSpacing: 0.6, marginHorizontal: 20, marginTop: 6, marginBottom: 8 },
  group: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
})
