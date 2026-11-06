import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, PermissionsAndroid, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { alarms, type Permissions, type SettingsPage } from '../../modules/birthday-alarms'
import { effectiveReminders } from '../domain/model'
import { Button, Card } from './controls'
import { haptic } from './haptics'
import { useT } from './i18n'
import { Sheet } from './Sheet'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'

type Step = 'notifications' | 'exact' | 'fullscreen' | 'battery'
const OPTIONAL: Step[] = ['fullscreen', 'battery']
const SKIPPED_KEY = 'permSkipped'
const SHOWN_KEY = 'permShown'

/**
 * Wann Screen 9 erscheint:
 * - nach dem Sichern des ersten Eintrags mit Erinnerung (einmal), nicht beim ersten Start
 * - beim Öffnen der App, wenn eine nötige Erlaubnis fehlt (z. B. Benachrichtigungen in Android
 *   abgeschaltet), oder eine freiwillige, die nicht mit "Später" oder "Fertig" übergangen wurde.
 */
export function usePermissionPrompt() {
  const store = useBirthdayStore()
  const { people, settings } = useSnapshot()
  const [open, setOpen] = useState(false)
  const [perms, setPerms] = useState<Permissions>(() => alarms.permissions())
  const skipped = useRef<Set<Step>>(new Set())
  const shown = useRef(false)
  const loaded = useRef(false)
  const repo = store

  const usesFullscreen = settings.enabled && people.some((p) => effectiveReminders(p, settings).some((r) => r.fullscreen))
  const hasReminders = settings.enabled && people.some((p) => effectiveReminders(p, settings).length > 0)

  const missing = useCallback(
    (p: Permissions): Step[] => {
      const list: Step[] = []
      if (!p.notifications) list.push('notifications')
      if (!p.exact) list.push('exact')
      if (usesFullscreen && !p.fullscreen) list.push('fullscreen')
      if (!p.battery) list.push('battery')
      return list
    },
    [usesFullscreen],
  )

  useEffect(() => {
    ;(async () => {
      const s = await repo.getMeta<Step[]>(SKIPPED_KEY)
      skipped.current = new Set(s ?? [])
      shown.current = (await repo.getMeta<boolean>(SHOWN_KEY)) === true
      loaded.current = true
    })()
  }, [repo])

  const check = useCallback(() => {
    const p = alarms.permissions()
    setPerms(p)
    if (!loaded.current || !shown.current || !hasReminders) return
    const need = missing(p).filter((s) => !OPTIONAL.includes(s) || !skipped.current.has(s))
    if (need.length) setOpen(true)
  }, [hasReminders, missing])

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check())
    const timer = setTimeout(check, 800)
    return () => {
      sub.remove()
      clearTimeout(timer)
    }
  }, [check])

  const afterFirstReminder = useCallback(() => {
    const p = alarms.permissions()
    setPerms(p)
    if (!shown.current) {
      shown.current = true
      repo.setMeta(SHOWN_KEY, true)
      if (missing(p).length) setOpen(true)
    }
  }, [missing, repo])

  const close = () => {
    // Übergangene freiwillige Schritte nicht bei jedem Öffnen wieder anbieten.
    for (const s of missing(alarms.permissions())) if (OPTIONAL.includes(s)) skipped.current.add(s)
    repo.setMeta(SKIPPED_KEY, [...skipped.current])
    setOpen(false)
  }

  return {
    afterFirstReminder,
    sheet: { open, perms, usesFullscreen, onClose: close, onRefresh: () => setPerms(alarms.permissions()) },
  }
}

export function PermissionSheet({ open, perms, usesFullscreen, onClose, onRefresh }: { open: boolean; perms: Permissions; usesFullscreen: boolean; onClose: () => void; onRefresh: () => void }) {
  const c = useColors()
  const f = useFont()
  const t = useT()

  useEffect(() => {
    if (!open) return
    const sub = AppState.addEventListener('change', (s) => s === 'active' && onRefresh())
    return () => sub.remove()
  }, [open, onRefresh])

  const allow = async (step: Step) => {
    haptic('tick')
    if (step === 'notifications' && Platform.OS === 'android' && Number(Platform.Version) >= 33) {
      const r = await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS' as never)
      onRefresh()
      if (r === 'granted') return
    }
    const page: SettingsPage = step
    await alarms.openSettings(page)
  }

  const steps: { key: Step; title: string; sub: string; ok: boolean; optional?: boolean }[] = [
    { key: 'notifications', title: t.permNotifications, sub: t.permNotificationsSub, ok: perms.notifications },
    { key: 'exact', title: t.permExact, sub: t.permExactSub, ok: perms.exact },
    ...(usesFullscreen ? [{ key: 'fullscreen' as Step, title: t.permFullscreen, sub: t.permFullscreenSub, ok: perms.fullscreen, optional: true }] : []),
    { key: 'battery', title: t.permBattery, sub: t.permBatterySub, ok: perms.battery },
  ]

  return (
    <Sheet open={open} title={t.permTitle} onClose={onClose} right={null} footer={<Button label={t.done} onPress={onClose} />}>
      <Text style={{ color: c.text2, fontSize: f(14), textAlign: 'center', lineHeight: f(20), marginBottom: 12 }}>{t.permText}</Text>
      <Card>
        {steps.map((s, i) => (
          <View key={s.key} style={[styles.step, i < steps.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.sep }]}>
            <View style={[styles.num, { backgroundColor: s.ok ? c.ok : c.accentSoft }]}>
              {s.ok ? <MaterialIcons name="check" size={16} color="#fff" /> : <Text style={{ color: c.accentDeep, fontWeight: '800', fontSize: f(13) }}>{i + 1}</Text>}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: c.text, fontWeight: '600', fontSize: f(15.5) }}>{s.title}</Text>
              <Text style={{ color: c.text2, fontSize: f(12.5), marginTop: 2, lineHeight: f(17) }}>{s.sub}</Text>
            </View>
            {!s.ok && (
              <Pressable onPress={() => allow(s.key)} style={[styles.allow, { backgroundColor: c.accent }]} accessibilityRole="button" accessibilityLabel={`${s.title}: ${t.allow}`}>
                <Text style={{ color: c.onAccent, fontWeight: '700', fontSize: f(13) }}>{t.allow}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </Card>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  num: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  allow: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
})
