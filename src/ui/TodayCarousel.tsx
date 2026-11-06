import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ScrollViewInstance } from 'react-native'
import { alarms } from '../../modules/birthday-alarms'
import { dayKey } from '../domain/dates'
import { effectiveReminders, type Settings } from '../domain/model'
import { occurrence, zoneOf } from '../domain/schedule'
import { localTime } from '../domain/zone'
import { Avatar } from './controls'
import type { TodayCard } from './derive'
import { useEnv } from './env'
import { haptic } from './haptics'
import { useLang, useT } from './i18n'
import { placeName, signLabel, time, weekdayTime } from './labels'
import { photoUri } from './photos'
import { useColors, useFont } from './theme'

/**
 * Karten für alle, die heute Geburtstag haben (Screen 1). Bei mehreren: wischen oder Pfeile,
 * "1 / 3" und Punkte zeigen die Position, die nächste Karte schaut rechts hervor.
 */
export function TodayCarousel({ cards, settings, onOpen }: { cards: TodayCard[]; settings: Settings; onOpen: (id: string) => void }) {
  const c = useColors()
  const { width } = useWindowDimensions()
  const [index, setIndex] = useState(0)
  const scroll = useRef<ScrollViewInstance>(null)
  const many = cards.length > 1
  const cardWidth = many ? width - 32 - 20 : width - 32
  const step = cardWidth + 8
  const at = Math.min(index, cards.length - 1)

  const go = (i: number) => {
    const next = Math.max(0, Math.min(cards.length - 1, i))
    haptic('tick')
    setIndex(next)
    scroll.current?.scrollTo({ x: next * step, animated: true })
  }

  return (
    <View style={{ marginBottom: 6 }}>
      <ScrollView
        ref={scroll}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / step))}
      >
        {cards.map((card, i) => (
          <Card
            key={card.person.id}
            card={card}
            width={cardWidth}
            settings={settings}
            position={many ? { i, n: cards.length, onPrev: () => go(i - 1), onNext: () => go(i + 1) } : null}
            onOpen={onOpen}
          />
        ))}
      </ScrollView>
      {many && (
        <View style={styles.dots} accessibilityElementsHidden>
          {cards.map((card, i) => (
            <View key={card.person.id} style={[styles.dot, { backgroundColor: i === at ? c.accentText : c.dark ? '#4a3540' : '#ecc9d7' }, i === at && { width: 16 }]} />
          ))}
        </View>
      )}
      {!many && <View style={{ height: 4 }} />}
    </View>
  )
}

function Card({
  card,
  width,
  settings,
  position,
  onOpen,
}: {
  card: TodayCard
  width: number
  settings: Settings
  position: { i: number; n: number; onPrev: () => void; onNext: () => void } | null
  onOpen: (id: string) => void
}) {
  const c = useColors()
  const t = useT()
  const f = useFont()
  const lang = useLang()
  const env = useEnv()
  const { person: p, kind, window: w, doneAt } = card
  const soon = kind === 'soon'
  const sign = signLabel(p.month, p.day, lang)
  const zone = zoneOf(p, env.ctx)
  const place = placeName(zone, lang)
  const travel = env.ctx.info.offsetMinutes(zone, env.now) !== env.ctx.info.offsetMinutes(env.ctx.myZone, env.now)

  const sub = soon
    ? [w.age !== null ? t.turns(w.age) : t.hasBirthday, sign.full].join(' · ')
    : [w.age !== null ? t.turnsToday(w.age) : t.birthdayToday, sign.full].join(' · ')

  let tz: string | null = null
  let reminderLine: string | null = null
  if (travel) {
    const theirs = localTime(env.now, zone, env.ctx.info)
    const mine = localTime(env.now, env.ctx.myZone, env.ctx.info)
    const cmp = theirs.y * 10000 + theirs.m * 100 + theirs.d - (mine.y * 10000 + mine.m * 100 + mine.d)
    if (soon) {
      const hours = Math.max(1, Math.ceil((w.start - env.now) / 3_600_000))
      const startMine = localTime(w.start, env.ctx.myZone, env.ctx.info)
      tz = `${t.onlyThere(place, weekdayTime(theirs, env.style))} ${t.startsThereIn(t.hours(hours), time(startMine.minute, env.style))}`
      const dayReminder = effectiveReminders(p, settings).find((r) => r.offset.n === 0)
      if (dayReminder && settings.enabled) {
        const occ = occurrence(p, dayReminder, w.day.y, env.ctx)
        reminderLine = t.reminderAt(time(localTime(occ, env.ctx.myZone, env.ctx.info).minute, env.style), time(localTime(occ, zone, env.ctx.info).minute, env.style), place)
      }
    } else if (cmp > 0) {
      tz = `${t.alreadyThere(place, weekdayTime(theirs, env.style))} ${t.stillHere(weekdayTime(mine, env.style))}`
    } else {
      tz = t.itIsThere(place, time(theirs.minute, env.style))
    }
  }

  const end = () => {
    haptic('success')
    alarms.markDone(p.id, dayKey(w.day))
    env.refresh()
  }

  const doneText = doneAt ? t.endedAt(time(localTime(doneAt, env.ctx.myZone, env.ctx.info).minute, env.style)) : null

  return (
    <Pressable
      onPress={() => onOpen(p.id)}
      style={[
        styles.card,
        { width, backgroundColor: soon ? c.card : c.todayBg, borderColor: soon ? c.accentText : c.todayBorder },
        soon && { borderStyle: 'dashed', borderWidth: 1.5 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${soon ? t.startsSoon : t.today}: ${p.name}, ${sub}`}
    >
      <View style={styles.head}>
        <MaterialIcons name={soon ? 'schedule' : 'cake'} size={15} color={c.todayText} />
        <Text style={[styles.headText, { color: c.todayText, fontSize: f(11.5) }]}>{(soon ? t.startsSoon : t.today).toLocaleUpperCase()}</Text>
        {position && (
          <View style={styles.nav}>
            <Pressable
              onPress={position.onPrev}
              disabled={position.i === 0}
              style={[styles.arrow, { backgroundColor: c.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)', opacity: position.i === 0 ? 0.35 : 1 }]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.previous}
            >
              <MaterialIcons name="chevron-left" size={18} color={c.accentDeep} />
            </Pressable>
            <Text style={{ color: c.todayText, fontWeight: '700', fontSize: f(12) }}>{t.pageOf(position.i + 1, position.n)}</Text>
            <Pressable
              onPress={position.onNext}
              disabled={position.i === position.n - 1}
              style={[styles.arrow, { backgroundColor: c.dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.9)', opacity: position.i === position.n - 1 ? 0.35 : 1 }]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t.next}
            >
              <MaterialIcons name="chevron-right" size={18} color={c.accentDeep} />
            </Pressable>
          </View>
        )}
      </View>
      <View style={styles.person}>
        <Avatar id={p.id} name={p.name} photo={photoUri(p.photo)} size={46} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.name, { color: c.text, fontSize: f(18) }]} numberOfLines={1}>
            {p.name}
          </Text>
          <Text style={{ color: c.todayText, fontSize: f(13.5), marginTop: 1 }} numberOfLines={2}>
            {sub}
          </Text>
        </View>
      </View>
      {!!p.note && !tz && (
        <View style={styles.noteLine}>
          <MaterialIcons name="sticky-note-2" size={14} color={c.todayNote} style={{ marginTop: 2 }} />
          <Text style={{ color: c.todayNote, fontSize: f(13), flex: 1, lineHeight: f(18) }} numberOfLines={2}>
            {p.note}
          </Text>
        </View>
      )}
      {tz && (
        <View style={[styles.tz, { backgroundColor: soon ? c.accentSoft : c.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)' }]}>
          <MaterialIcons name="schedule" size={14} color={c.todayNote} style={{ marginTop: 2 }} />
          <Text style={{ color: c.todayNote, fontSize: f(13), flex: 1, lineHeight: f(18) }}>{tz}</Text>
        </View>
      )}
      {reminderLine && <Text style={{ color: c.todayText, fontSize: f(12.5), marginTop: 8 }}>{reminderLine}</Text>}
      {!soon &&
        (doneText ? (
          <View style={[styles.button, { backgroundColor: c.dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)' }]}>
            <MaterialIcons name="check" size={17} color={c.ok} />
            <Text style={{ color: c.ok, fontWeight: '700', fontSize: f(14.5) }}>{doneText}</Text>
          </View>
        ) : (
          <Pressable onPress={end} style={[styles.button, { backgroundColor: c.accent }]} android_ripple={{ color: c.ripple }} accessibilityRole="button">
            <MaterialIcons name="check" size={17} color={c.onAccent} />
            <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: f(14.5) }}>{t.end}</Text>
          </Pressable>
        ))}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 13, borderWidth: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 },
  headText: { fontWeight: '800', letterSpacing: 0.8 },
  nav: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 6 },
  arrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  name: { fontWeight: '800' },
  noteLine: { flexDirection: 'row', gap: 6, marginTop: 9 },
  tz: { flexDirection: 'row', gap: 7, marginTop: 9, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  button: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 11, minHeight: 42, borderRadius: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
})
