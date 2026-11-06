import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { monthName } from '../domain/format'
import { effectiveReminders, GROUP_COLORS, NO_GROUP, type Group } from '../domain/model'
import { zoneCity } from '../domain/zone'
import { Button } from './controls'
import { deriveHome } from './derive'
import { DetailScreen } from './DetailScreen'
import { EditSheet } from './EditSheet'
import { useEnv } from './env'
import { GroupDot, useGroupName } from './Groups'
import { haptic } from './haptics'
import { useLang, useT } from './i18n'
import { ImportScreen } from './ImportScreen'
import { hoursText, placeTitle, shortDate, signLabel } from './labels'
import { PermissionSheet, usePermissionPrompt } from './PermissionSheet'
import { PersonRow } from './PersonRow'
import { photoUri } from './photos'
import { FONT_STEPS, type Prefs } from './prefs'
import { SearchScreen } from './SearchScreen'
import { SettingsSheet } from './SettingsSheet'
import { SITE_URL } from './site'
import { SnackbarHost, useSnackbar } from './Snackbar'
import { TodayCarousel } from './TodayCarousel'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'

interface Props {
  prefs: Prefs
  onPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  keepOnReset: string[]
  /** Person aus einer angetippten Benachrichtigung. */
  openRequest: { id: string; n: number } | null
}

/** Startseite (Screens 1, 1b, 14, 15, 17, 18). */
export function MainScreen({ prefs, onPref, keepOnReset, openRequest }: Props) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const insets = useSafeAreaInsets()
  const store = useBirthdayStore()
  const { people, settings } = useSnapshot()
  const env = useEnv()
  const snack = useSnackbar()

  const [detailId, setDetailId] = useState<string | null>(null)
  const [newOpen, setNewOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [scrollEnabled, setScrollEnabled] = useState(true)
  const [titleHeight, setTitleHeight] = useState(60)
  const scrollY = useRef(new Animated.Value(0)).current
  const perm = usePermissionPrompt()
  /** Gewählte Gruppe auf der Startseite, null: alle. Bleibt beim nächsten Öffnen erhalten. */
  const [filter, setFilterState] = useState<string | null>(null)

  useEffect(() => {
    store.getMeta<string>(FILTER_KEY).then((v) => typeof v === 'string' && setFilterState(v)).catch(() => {})
  }, [store])
  const setFilter = (id: string | null) => {
    haptic('tick')
    setFilterState(id)
    store.setMeta(FILTER_KEY, id)
  }
  const groups = settings.groups
  const groupName = useGroupName()
  const active: Group | undefined = groups.find((g) => g.id === filter)
  const visible = useMemo(() => (active ? people.filter((p) => p.group === active.id) : people), [people, active])
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups])
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of people) if (p.group) m.set(p.group, (m.get(p.group) ?? 0) + 1)
    return m
  }, [people])

  useEffect(() => {
    if (openRequest && store.get(openRequest.id)) setDetailId(openRequest.id)
  }, [openRequest, store])

  const home = useMemo(() => deriveHome(visible, env.now, env.ctx, env.done), [visible, env.now, env.ctx, env.done])
  const todayCount = home.cards.filter((x) => x.kind === 'today').length
  const soonCard = home.cards.find((x) => x.kind === 'soon')

  let subtitle = (active ? `${active.name} · ` : '') + t.entries(visible.length)
  if (todayCount > 0) subtitle += ` · ${t.todayCount(todayCount)}`
  else if (soonCard) subtitle += ` · ${t.nextInHours(Math.max(1, Math.ceil((soonCard.window.start - env.now) / 3_600_000)))}`
  else if (home.items.length) subtitle += ` · ${t.nextIn(home.items[0].days)}`

  const diff = env.ctx.info.offsetMinutes(env.ctx.myZone, env.now) - env.ctx.info.offsetMinutes(env.ctx.homeZone, env.now)
  const travel =
    diff !== 0
      ? (diff > 0 ? t.travelAhead : t.travelBehind)(zoneCity(env.ctx.myZone), t.hoursShort(hoursText(diff, lang)), placeTitle(env.ctx.homeZone, lang))
      : null

  const remove = useCallback(
    (id: string) => {
      const p = store.get(id)
      store.remove([id])
      snack({ message: t.deleted(p?.name ?? ''), action: { label: t.undo, run: () => store.restore([id]) } })
    },
    [store, snack, t],
  )
  const gesture = useCallback((active: boolean) => setScrollEnabled(!active), [])
  const onSwipeStart = useCallback(() => gesture(true), [gesture])
  const onSwipeEnd = useCallback(() => gesture(false), [gesture])

  const font = (delta: number) => {
    const step = Math.max(0, Math.min(FONT_STEPS.length - 1, prefs.fontStep + delta))
    if (step === prefs.fontStep) return
    haptic('tick')
    onPref('fontStep', step)
    snack({ message: t.fontSize(Math.round(FONT_STEPS[step] * 100)) })
  }

  const created = (hasReminders: boolean) => {
    if (hasReminders) perm.afterFirstReminder()
  }

  const showPause = !settings.enabled && !settings.pauseBannerClosed
  const topBar = insets.top + 56
  const titleOpacity = scrollY.interpolate({ inputRange: [titleHeight * 0.6, titleHeight], outputRange: [0, 1], extrapolate: 'clamp' })

  return (
    <View style={[styles.fill, { backgroundColor: c.bg }]}>
      <Animated.ScrollView
        style={{ marginTop: topBar }}
        scrollEnabled={scrollEnabled}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        <View style={styles.titleBlock} onLayout={(e) => setTitleHeight(e.nativeEvent.layout.height)}>
          <Text style={[styles.title, { color: c.text, fontSize: f(34) }]} accessibilityRole="header">
            {t.homeTitle}
          </Text>
          {people.length > 0 && <Text style={[styles.subtitle, { color: c.text2, fontSize: f(15) }]}>{subtitle}</Text>}
          {travel && (
            <View style={styles.travel}>
              <MaterialIcons name="public" size={15} color={c.text2} />
              <Text style={{ color: c.text2, fontSize: f(13.5), flex: 1 }}>{travel}</Text>
            </View>
          )}
        </View>

        {showPause && (
          <View style={[styles.pause, { backgroundColor: c.pauseBg }]}>
            <MaterialIcons name="notifications-off" size={24} color={c.pauseText} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.pauseText, fontWeight: '700', fontSize: f(15) }}>{t.paused}</Text>
              <Text style={{ color: c.pauseSub, fontSize: f(13), marginTop: 1 }}>{t.pausedText}</Text>
              <Pressable
                onPress={() => {
                  haptic('success')
                  store.setSettings({ enabled: true })
                  snack({ message: t.remindersOn })
                }}
                style={[styles.pauseButton, { backgroundColor: c.accent }]}
                accessibilityRole="button"
              >
                <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: f(14) }}>{t.switchOn}</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => store.setSettings({ pauseBannerClosed: true })} hitSlop={10} style={styles.pauseClose} accessibilityRole="button" accessibilityLabel={t.closeHint}>
              <MaterialIcons name="close" size={20} color={c.pauseSub} />
            </Pressable>
          </View>
        )}

        <View style={styles.addRow}>
          <Pressable onPress={() => setSearchOpen(true)} style={[styles.search, { backgroundColor: c.card }]} android_ripple={{ color: c.ripple }} accessibilityRole="search" accessibilityLabel={t.search}>
            <MaterialIcons name="search" size={20} color={c.text3} />
            <Text style={{ color: c.text3, fontSize: f(16) }}>{t.search}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              haptic('tick')
              setNewOpen(true)
            }}
            style={[styles.fab, { backgroundColor: c.accent }]}
            android_ripple={{ color: c.ripple, borderless: true, radius: 26 }}
            accessibilityRole="button"
            accessibilityLabel={t.newEntry}
          >
            <MaterialIcons name="add" size={30} color={c.onAccent} />
          </Pressable>
        </View>

        {groups.length > 0 && people.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
            <FilterChip label={t.allGroups} active={!active} onPress={() => setFilter(null)} />
            {groups.map((g) => (
              <FilterChip key={g.id} group={g} label={groupName(g)} count={counts.get(g.id) ?? 0} active={active?.id === g.id} onPress={() => setFilter(active?.id === g.id ? null : g.id)} />
            ))}
          </ScrollView>
        )}

        {home.cards.length > 0 && <TodayCarousel cards={home.cards} settings={settings} onOpen={setDetailId} />}

        {people.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: c.accentSoft }]}>
              <MaterialIcons name="cake" size={44} color={c.accentText} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text, fontSize: f(20) }]}>{t.emptyTitle}</Text>
            <Text style={[styles.emptyText, { color: c.text2, fontSize: f(15) }]}>{t.emptyText}</Text>
            <View style={{ alignSelf: 'stretch', marginTop: 20 }}>
              <Button label={t.importContacts} kind="plain" icon="contacts" onPress={() => setImportOpen(true)} />
            </View>
            <Text style={[styles.signature, { color: c.text3, fontSize: f(14) }]}>
              {t.appBy}{' '}
              <Text style={{ color: c.accentText, fontWeight: '500' }} onPress={() => Linking.openURL(SITE_URL).catch(() => {})} accessibilityRole="link">
                aaron.de
              </Text>
            </Text>
          </View>
        ) : active && visible.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: c.card }]}>
              <GroupDot group={active} size={28} />
            </View>
            <Text style={[styles.emptyTitle, { color: c.text, fontSize: f(18), textAlign: 'center' }]}>{t.groupEmpty(groupName(active))}</Text>
            <Text style={[styles.emptyText, { color: c.text2, fontSize: f(15) }]}>{t.groupEmptyText}</Text>
          </View>
        ) : (
          home.sections.map((section) => (
            <View key={section.key}>
              <View style={styles.sec}>
                <Text style={[styles.secText, { color: c.text2, fontSize: f(12) }]}>{monthName(section.month, lang).toLocaleUpperCase()}</Text>
                <Text style={{ color: c.text3, fontSize: f(13) }}>{section.items.length}</Text>
              </View>
              <View style={[styles.group, { backgroundColor: c.card }]}>
                {section.items.map((it, i) => {
                  const p = it.person
                  const sign = signLabel(p.month, p.day, lang)
                  const sub = [shortDate(it.window.day, env.style), it.window.age !== null ? (it.days === 0 ? t.turned(it.window.age) : t.turns(it.window.age)) : null].filter(Boolean).join(' · ')
                  return (
                    <PersonRow
                      key={p.id}
                      id={p.id}
                      name={p.name}
                      photo={photoUri(p.photo)}
                      sign={sign.symbol}
                      groupColor={!active && p.group ? groupColorOf(groupById.get(p.group)) : null}
                      sub={sub}
                      badge={it.days === 1 ? t.tomorrow : t.inDays(it.days)}
                      soon={it.days <= 14}
                      hasNote={!!p.note.trim()}
                      noReminder={effectiveReminders(p, settings).length === 0}
                      last={i === section.items.length - 1}
                      onOpen={setDetailId}
                      onDelete={remove}
                      onSwipeStart={onSwipeStart}
                      onSwipeEnd={onSwipeEnd}
                    />
                  )
                })}
              </View>
            </View>
          ))
        )}
      </Animated.ScrollView>

      <View style={[styles.topBar, { height: topBar, paddingTop: insets.top, backgroundColor: c.bg }]} pointerEvents="box-none">
        <Animated.View style={[styles.topTitleWrap, { opacity: titleOpacity }]} pointerEvents="none">
          <Text style={[styles.topTitle, { color: c.text, fontSize: f(20) }]} numberOfLines={1}>
            {t.homeTitle}
          </Text>
        </Animated.View>
        <IconButton label={t.fontSmaller} disabled={prefs.fontStep === 0} onPress={() => font(-1)}>
          <Text style={[styles.fontIcon, { fontSize: 15, color: prefs.fontStep === 0 ? c.text3 : c.text }]}>A−</Text>
        </IconButton>
        <IconButton label={t.fontLarger} disabled={prefs.fontStep === FONT_STEPS.length - 1} onPress={() => font(1)}>
          <Text style={[styles.fontIcon, { fontSize: 21, color: prefs.fontStep === FONT_STEPS.length - 1 ? c.text3 : c.text }]}>A+</Text>
        </IconButton>
        <IconButton label={t.settings} onPress={() => setSettingsOpen(true)}>
          <MaterialIcons name="more-vert" size={24} color={c.text} />
        </IconButton>
      </View>

      <SnackbarHost bottom={insets.bottom + 16} />

      <EditSheet
        open={newOpen}
        id={null}
        initialGroup={active?.id ?? null}
        onClose={() => setNewOpen(false)}
        onCreated={(hasReminders, id, mode) => {
          created(hasReminders)
          // Bei "Eigene" gleich den Eintrag öffnen, dort lassen sich die Erinnerungen anpassen.
          if (mode === 'custom') setTimeout(() => setDetailId(id), 300)
        }}
      />
      <SearchScreen open={searchOpen} onClose={() => setSearchOpen(false)} onOpen={(id) => setDetailId(id)} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        prefs={prefs}
        onPref={onPref}
        keepOnReset={keepOnReset}
        onImport={() => {
          setSettingsOpen(false)
          setImportOpen(true)
        }}
        onReminderAdded={() => perm.afterFirstReminder()}
      />
      <ImportScreen open={importOpen} onClose={() => setImportOpen(false)} onImported={(n) => n > 0 && created(settings.defaults.length > 0)} />
      {detailId && <DetailScreen id={detailId} onClose={() => setDetailId(null)} onDelete={remove} onReminderAdded={() => perm.afterFirstReminder()} />}
      <PermissionSheet {...perm.sheet} />
    </View>
  )
}

const FILTER_KEY = 'ui:groupFilter'

/** Farbpunkt hinter dem Namen. "Ohne Gruppe" bekommt keinen. */
const groupColorOf = (g: Group | undefined) => (g && g.id !== NO_GROUP ? GROUP_COLORS[g.color] : null)

/** Chip der Gruppen auf der Startseite (Screens G1 und G2). */
function FilterChip({ label, group, count, active, onPress }: { label: string; group?: Group; count?: number; active: boolean; onPress: () => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? c.accent : c.card }]}
      android_ripple={{ color: c.ripple }}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={group ? t.showGroup(label) : label}
    >
      {group && <GroupDot group={group} size={10} />}
      <Text style={{ color: active ? c.onAccent : c.text, fontWeight: '600', fontSize: f(14) }} numberOfLines={1}>
        {label}
      </Text>
      {count !== undefined && <Text style={{ color: active ? c.onAccent : c.text3, opacity: active ? 0.7 : 1, fontWeight: '500', fontSize: f(13) }}>{count}</Text>}
    </Pressable>
  )
}

function IconButton({ label, disabled, onPress, children }: { label: string; disabled?: boolean; onPress: () => void; children: React.ReactNode }) {
  const c = useColors()
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={styles.menu}
      android_ripple={{ color: c.ripple, borderless: true, radius: 22 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
    >
      {children}
    </Pressable>
  )
}


const styles = StyleSheet.create({
  fill: { flex: 1 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 },
  topTitleWrap: { flex: 1, marginLeft: 16 },
  topTitle: { fontWeight: '600' },
  menu: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  fontIcon: { fontWeight: '700', letterSpacing: -0.5 },
  titleBlock: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 2 },
  travel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  pause: { flexDirection: 'row', gap: 12, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 14, paddingRight: 40 },
  pauseButton: { alignSelf: 'flex-start', marginTop: 10, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  pauseClose: { position: 'absolute', top: 10, right: 10, padding: 4 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 12 },
  search: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 50, borderRadius: 25, paddingHorizontal: 16, overflow: 'hidden' },
  fab: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 18, paddingHorizontal: 13, minHeight: 36, overflow: 'hidden' },
  sec: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
  secText: { fontWeight: '700', letterSpacing: 0.7, flex: 1 },
  group: { marginHorizontal: 16, borderRadius: 16, overflow: 'hidden' },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 24 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontWeight: '600', marginBottom: 6 },
  emptyText: { textAlign: 'center' },
  signature: { marginTop: 24 },
})
