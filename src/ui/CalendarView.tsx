import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native'
import { addMonths, birthdaysInMonth, monthGrid, type YearMonth } from '../domain/calendar'
import { ageIn, dayNumber, type Day } from '../domain/dates'
import { longDate, monthName, monthShort, shortDate, weekdayShort } from '../domain/format'
import { effectiveReminders, GROUP_COLORS, NO_GROUP, type Group, type Person } from '../domain/model'
import { localDay } from '../domain/zone'
import { Avatar, Button } from './controls'
import { useEnv } from './env'
import { haptic } from './haptics'
import { useLang, useT } from './i18n'
import { signLabel } from './labels'
import { PersonRow } from './PersonRow'
import { photoUri } from './photos'
import { useColors, useFont } from './theme'
import { useSnapshot } from './useStore'

interface Props {
  /** Einträge nach dem Gruppenfilter der Startseite. */
  people: Person[]
  groups: Group[]
  onOpen: (id: string) => void
  onCreateOn: (date: { day: number; month: number }) => void
}

/** Montag bis Sonntag als Index der Wochentage (0 = Sonntag). */
const WEEK = [1, 2, 3, 4, 5, 6, 0]
const CELL_AVATAR = 22

/**
 * Kalender auf der Startseite (Entwurf K1 bis K4).
 * - Monat: Tage mit Geburtstag zeigen bis zu zwei Bilder mit einem Ring in der Farbe der Gruppe,
 *   ab drei Personen "+1", "+2". Darunter die Geburtstage des Monats.
 * - Ein Tag angetippt: Die Liste zeigt nur diesen Tag. Ein leerer Tag bietet einen neuen Eintrag an.
 * - Der Monatsname öffnet das ganze Jahr, ein Monat dort wieder den Monat.
 */
export function CalendarView({ people, groups, onOpen, onCreateOn }: Props) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const env = useEnv()
  const { settings } = useSnapshot()
  const today = localDay(env.now, env.ctx.homeZone, env.ctx.info)
  const [ym, setYm] = useState<YearMonth>({ year: today.y, month: today.m })
  const [selected, setSelected] = useState<number | null>(null)
  const [mode, setMode] = useState<'month' | 'year'>('month')
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const ringOf = (p: Person) => {
    const g = groupById.get(p.group)
    return g && g.id !== NO_GROUP ? GROUP_COLORS[g.color] : c.text3
  }

  useEffect(() => setSelected(null), [ym.year, ym.month])

  const go = (n: number) => {
    haptic('tick')
    setYm((v) => (mode === 'year' ? { year: v.year + n, month: v.month } : addMonths(v, n)))
  }

  // Nach links oder rechts wischen blättert, wie die Pfeile.
  const goRef = useRef(go)
  goRef.current = go
  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (g.dx < -50) goRef.current(1)
        else if (g.dx > 50) goRef.current(-1)
      },
      onPanResponderTerminationRequest: () => true,
    }),
  ).current

  const byDay = useMemo(() => {
    const map = birthdaysInMonth(people, ym, settings.feb29)
    for (const list of map.values()) list.sort((a, b) => a.name.localeCompare(b.name, lang))
    return map
  }, [people, ym, settings.feb29, lang])

  const todayNum = dayNumber(today)
  const isToday = (y: number, m: number, d: number) => today.y === y && today.m === m && today.d === d

  const header = (title: string, onTitle: (() => void) | null, titleLabel: string, prevLabel: string, nextLabel: string) => (
    <View style={styles.header}>
      <NavButton icon="chevron-left" label={prevLabel} onPress={() => go(-1)} />
      <Pressable onPress={onTitle ?? undefined} disabled={!onTitle} style={styles.titleBtn} accessibilityRole={onTitle ? 'button' : 'header'} accessibilityLabel={titleLabel}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: f(22) }}>{title}</Text>
      </Pressable>
      <NavButton icon="chevron-right" label={nextLabel} onPress={() => go(1)} />
    </View>
  )

  if (mode === 'year') {
    return (
      <View {...pan.panHandlers}>
        {header(String(ym.year), null, String(ym.year), t.prevYear, t.nextYear)}
        <View style={styles.yearGrid}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <MiniMonth
              key={m}
              ym={{ year: ym.year, month: m }}
              people={people}
              current={today.y === ym.year && today.m === m}
              todayDay={today.y === ym.year && today.m === m ? today.d : null}
              colorOf={ringOf}
              onPress={() => {
                haptic('tick')
                setYm({ year: ym.year, month: m })
                setMode('month')
              }}
            />
          ))}
        </View>
      </View>
    )
  }

  const cells = monthGrid(ym)
  const rows: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))

  const dayOf = (d: number): Day => ({ y: ym.year, m: ym.month, d })
  const rowFor = (p: Person, d: number, last: boolean) => {
    const day = dayOf(d)
    const diff = dayNumber(day) - todayNum
    const age = ageIn(p.year, ym.year)
    const sign = signLabel(p.month, p.day, lang)
    const sub = [shortDate(day, env.style), age !== null && age > 0 ? (diff < 0 ? t.turned(age) : t.turns(age)) : null].filter(Boolean).join(' · ')
    const badge = diff < 0 ? null : diff === 0 ? t.today : diff === 1 ? t.tomorrow : t.inDays(diff)
    return (
      <PersonRow
        key={`${p.id}-${d}`}
        id={p.id}
        name={p.name}
        photo={photoUri(p.photo)}
        sign={sign.symbol}
        groupColor={p.group !== NO_GROUP ? ringOf(p) : null}
        sub={sub}
        badge={badge}
        soon={diff >= 0 && diff <= 14}
        hasNote={!!p.note.trim()}
        noReminder={effectiveReminders(p, settings).length === 0}
        last={last}
        onOpen={onOpen}
      />
    )
  }

  const monthTitle = `${monthName(ym.month, lang)} ${ym.year}`
  const total = [...byDay.values()].reduce((n, l) => n + l.length, 0)
  const days = [...byDay.keys()].sort((a, b) => a - b)
  const chosen = selected !== null ? (byDay.get(selected) ?? []) : null

  return (
    <View>
      <View {...pan.panHandlers}>
        {header(monthTitle, () => {
          haptic('tick')
          setMode('year')
        }, `${monthTitle}. ${t.showYear}`, t.prevMonth, t.nextMonth)}
        <View style={styles.week}>
          {WEEK.map((w) => (
            <Text key={w} style={[styles.weekText, { color: c.text3, fontSize: f(11.5) }]} allowFontScaling={false}>
              {weekdayShort(w, lang)}
            </Text>
          ))}
        </View>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.row}>
            {row.map((d, ci) => {
              if (d === null) return <View key={ci} style={styles.cell} />
              const list = byDay.get(d) ?? []
              const sel = selected === d
              const tod = isToday(ym.year, ym.month, d)
              return (
                <Pressable
                  key={ci}
                  onPress={() => {
                    haptic('tick')
                    setSelected(sel ? null : d)
                  }}
                  style={[styles.cell, list.length > 0 && { backgroundColor: c.card }, sel && { backgroundColor: c.accentSoft, borderColor: c.accentText, borderWidth: 2 }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: sel }}
                  accessibilityLabel={t.calDayLabel(longDate(dayOf(d), env.style), list.length)}
                >
                  <View style={[styles.num, tod && { backgroundColor: c.accentText }]}>
                    <Text style={{ color: tod ? '#fff' : c.text, fontWeight: tod || list.length ? '700' : '500', fontSize: f(13) }} allowFontScaling={false}>
                      {d}
                    </Text>
                  </View>
                  {list.length > 0 && (
                    <View style={styles.faces}>
                      {list.slice(0, 2).map((p, i) => (
                        <View key={p.id} style={[styles.ring, { borderColor: ringOf(p), backgroundColor: c.card, marginLeft: i === 0 ? 0 : -9, zIndex: 2 - i }]}>
                          <Avatar id={p.id} name={p.name} photo={photoUri(p.photo)} size={CELL_AVATAR} />
                        </View>
                      ))}
                      {list.length > 2 && (
                        <View style={[styles.more, { backgroundColor: c.accentDeep, borderColor: c.card }]}>
                          <Text style={styles.moreText} allowFontScaling={false}>
                            +{list.length - 2}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                </Pressable>
              )
            })}
          </View>
        ))}
      </View>

      {chosen ? (
        <>
          <Text style={[styles.sec, { color: c.text2, fontSize: f(12) }]}>{longDate(dayOf(selected!), env.style).toLocaleUpperCase()}</Text>
          {chosen.length > 0 ? (
            <View style={[styles.card, { backgroundColor: c.card }]}>{chosen.map((p, i) => rowFor(p, selected!, i === chosen.length - 1))}</View>
          ) : (
            <Text style={[styles.empty, { color: c.text2, fontSize: f(14.5) }]}>{t.calDayEmpty}</Text>
          )}
          <View style={styles.add}>
            <Button
              label={t.calAddOnDay}
              kind="plain"
              icon="add"
              onPress={() => {
                // Bei Geburtstagen, die nur in Schaltjahren am 29. liegen, gilt der gewählte Kalendertag.
                onCreateOn({ day: selected!, month: ym.month })
              }}
            />
          </View>
        </>
      ) : (
        <>
          <Text style={[styles.sec, { color: c.text2, fontSize: f(12) }]}>
            {monthName(ym.month, lang).toLocaleUpperCase()} · {t.calCount(total).toLocaleUpperCase()}
          </Text>
          {total > 0 ? (
            <View style={[styles.card, { backgroundColor: c.card }]}>
              {days.flatMap((d, di) => (byDay.get(d) ?? []).map((p, i, l) => rowFor(p, d, di === days.length - 1 && i === l.length - 1)))}
            </View>
          ) : (
            <Text style={[styles.empty, { color: c.text2, fontSize: f(14.5) }]}>{t.calMonthEmpty}</Text>
          )}
        </>
      )}
    </View>
  )
}

/** Ein Monat in der Jahresübersicht. Geburtstage sind farbige Kreise, bei mehreren Gruppen geteilt. */
function MiniMonth({
  ym,
  people,
  current,
  todayDay,
  colorOf,
  onPress,
}: {
  ym: YearMonth
  people: Person[]
  current: boolean
  todayDay: number | null
  colorOf: (p: Person) => string
  onPress: () => void
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const { settings } = useSnapshot()
  const byDay = birthdaysInMonth(people, ym, settings.feb29)
  const count = [...byDay.values()].reduce((n, l) => n + l.length, 0)
  const cells = monthGrid(ym)
  return (
    <Pressable
      onPress={onPress}
      style={[styles.mini, { backgroundColor: c.card }, current && { borderColor: c.accentText, borderWidth: 2 }]}
      accessibilityRole="button"
      accessibilityLabel={`${t.showMonth(monthName(ym.month, lang))}, ${t.calCount(count)}`}
    >
      <View style={styles.miniHead}>
        <Text style={{ color: c.text, fontWeight: '800', fontSize: f(12.5) }} allowFontScaling={false}>
          {monthShort(ym.month, lang)}
        </Text>
        {count > 0 && (
          <Text style={{ color: c.accentText, fontWeight: '800', fontSize: f(12) }} allowFontScaling={false}>
            {count}
          </Text>
        )}
      </View>
      <View style={styles.miniGrid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={i} style={styles.miniCell} />
          const list = byDay.get(d)
          const colors = list ? [...new Set(list.map(colorOf))] : []
          return (
            <View key={i} style={styles.miniCell}>
              {colors.length > 0 ? (
                <View style={styles.miniDot}>
                  {colors.slice(0, 3).map((col) => (
                    <View key={col} style={{ flex: 1, backgroundColor: col }} />
                  ))}
                  <Text style={[styles.miniNum, styles.miniNumOn]} allowFontScaling={false}>
                    {d}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.miniNum, { color: todayDay === d ? c.accentText : c.text3, fontWeight: todayDay === d ? '800' : '500' }]} allowFontScaling={false}>
                  {d}
                </Text>
              )}
            </View>
          )
        })}
      </View>
    </Pressable>
  )
}

function NavButton({ icon, label, onPress }: { icon: 'chevron-left' | 'chevron-right'; label: string; onPress: () => void }) {
  const c = useColors()
  return (
    <Pressable onPress={onPress} style={styles.nav} android_ripple={{ color: c.ripple, borderless: true, radius: 22 }} accessibilityRole="button" accessibilityLabel={label}>
      <MaterialIcons name={icon} size={28} color={c.text} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, paddingBottom: 6 },
  titleBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },
  nav: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row', paddingHorizontal: 10, paddingBottom: 4 },
  weekText: { flex: 1, textAlign: 'center', fontWeight: '700' },
  row: { flexDirection: 'row', paddingHorizontal: 10, gap: 3, marginBottom: 3 },
  cell: { flex: 1, height: 56, borderRadius: 12, alignItems: 'center', paddingTop: 4, gap: 3, borderWidth: 2, borderColor: 'transparent' },
  num: { minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 },
  faces: { flexDirection: 'row', alignItems: 'center' },
  ring: { borderWidth: 2, borderRadius: CELL_AVATAR / 2 + 3, padding: 1 },
  more: { position: 'absolute', right: -12, top: -5, borderRadius: 8, borderWidth: 1.5, paddingHorizontal: 3, zIndex: 3 },
  moreText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  sec: { fontWeight: '700', letterSpacing: 0.7, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  card: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  empty: { paddingHorizontal: 20, paddingBottom: 4 },
  add: { paddingHorizontal: 16, paddingTop: 8 },
  yearGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 },
  mini: { width: '31.5%', borderRadius: 12, padding: 6, borderWidth: 2, borderColor: 'transparent' },
  miniHead: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, paddingBottom: 3 },
  miniGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  miniCell: { width: `${100 / 7}%`, height: 13, alignItems: 'center', justifyContent: 'center' },
  miniDot: { width: 12, height: 12, borderRadius: 6, overflow: 'hidden', flexDirection: 'row' },
  miniNum: { fontSize: 7.5, textAlign: 'center' },
  miniNumOn: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, lineHeight: 12, color: '#fff', fontWeight: '800' },
})
