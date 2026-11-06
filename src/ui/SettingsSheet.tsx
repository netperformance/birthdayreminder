import Constants from 'expo-constants'
import * as DocumentPicker from 'expo-document-picker'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useState } from 'react'
import { Alert, Linking, StyleSheet, Text } from 'react-native'
import { LANGS, type Lang } from '../domain/lang'
import { zoneCity } from '../domain/zone'
import { BackupError } from '../store/store'
import { Card, Hint, Label, Row, Segmented, Toggle } from './controls'
import { useEnv } from './env'
import { GroupEditor, GroupOrder } from './Groups'
import { haptic } from './haptics'
import { useLang, useT } from './i18n'
import { placeTitle } from './labels'
import { cleanupPhotos, photoFiles } from './photos'
import type { Prefs } from './prefs'
import { ReminderList } from './ReminderList'
import { Sheet } from './Sheet'
import { REPO_URL, SITE_URL } from './site'
import { useSnackbar } from './Snackbar'
import { useColors, useFont } from './theme'
import { useBirthdayStore, useSnapshot } from './useStore'
import { ZonePicker } from './ZonePicker'

/** Jede Sprache steht in ihrer eigenen Sprache. */
const LANGUAGE_NAMES: Record<Lang, string> = { de: 'Deutsch', en: 'English' }

/** Einstellungen (Screens 7 und 8). */
export function SettingsSheet({
  open,
  onClose,
  prefs,
  onPref,
  keepOnReset,
  onImport,
  onReminderAdded,
}: {
  open: boolean
  onClose: () => void
  prefs: Prefs
  onPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  keepOnReset: string[]
  onImport: () => void
  onReminderAdded: () => void
}) {
  const c = useColors()
  const f = useFont()
  const t = useT()
  const lang = useLang()
  const env = useEnv()
  const store = useBirthdayStore()
  const { settings, people } = useSnapshot()
  const snack = useSnackbar()
  const [zoneOpen, setZoneOpen] = useState(false)
  const [dragging, setDragging] = useState(false)
  /** Gruppe im Editor, id null: neue Gruppe. Die id bleibt beim Schließen stehen, damit der Titel nicht springt. */
  const [groupEdit, setGroupEdit] = useState<{ open: boolean; id: string | null }>({ open: false, id: null })

  const usingStandard = people.filter((p) => p.mode === 'standard').length

  const exportBackup = async () => {
    try {
      const name = `${t.backupFile}-${new Date().toISOString().slice(0, 10)}.json`
      const file = new File(Paths.cache, name)
      file.create({ overwrite: true })
      await file.write(JSON.stringify(await store.exportBackup(photoFiles)))
      if (!(await Sharing.isAvailableAsync())) throw new Error(t.shareUnavailable)
      await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: t.saveBackup })
    } catch (error) {
      snack({ message: t.backupFailed((error as Error).message) })
    }
  }

  const importBackup = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true })
      if (result.canceled || !result.assets[0]) return
      const text = await new File(result.assets[0].uri).text()
      const count = await store.importBackup(JSON.parse(text), photoFiles)
      haptic('success')
      snack({ message: t.backupLoaded(count) })
    } catch (error) {
      const message =
        error instanceof SyntaxError
          ? t.invalidBackup
          : error instanceof BackupError
            ? error.code === 'damaged'
              ? t.damagedBackup
              : t.notABackup
            : (error as Error).message
      snack({ message })
    }
  }

  const confirmReset = () =>
    Alert.alert(t.resetTitle, t.resetText(people.length), [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.deleteForever,
        style: 'destructive',
        onPress: async () => {
          await store.reset({ keepMeta: keepOnReset })
          cleanupPhotos(new Set())
          onClose()
          snack({ message: t.allDeleted })
        },
      },
    ])

  return (
    <Sheet open={open} title={t.settings} onClose={onClose} scrollEnabled={!dragging}>
      <Label first>{t.language}</Label>
      <Segmented options={LANGS.map((l) => [l, LANGUAGE_NAMES[l]] as const)} value={prefs.language} onChange={(v) => onPref('language', v)} />

      <Card style={{ marginTop: 16 }}>
        <Row
          icon={settings.enabled ? 'notifications-active' : 'notifications-off'}
          label={t.allReminders}
          sub={t.allRemindersSub}
          right={<Toggle value={settings.enabled} onChange={(v) => store.setSettings({ enabled: v })} />}
          onPress={() => store.setSettings({ enabled: !settings.enabled })}
          last
        />
      </Card>

      <Label>{t.standardForAll}</Label>
      <ReminderList
        reminders={settings.defaults}
        onChange={(list) => {
          store.setSettings({ defaults: list })
          onReminderAdded()
        }}
      />
      <Hint>{t.appliesTo(usingStandard, people.length)}</Hint>

      <Label>{t.groups}</Label>
      <GroupOrder groups={settings.groups} onChange={(o) => store.setGroupOrder(o)} onDragChange={setDragging} onEdit={(id) => setGroupEdit({ open: true, id })} />
      <Card style={{ marginTop: 8 }}>
        <Row icon="add" label={t.newGroup} accent onPress={() => setGroupEdit({ open: true, id: null })} last />
      </Card>
      <Hint>{settings.groups.length > 1 ? t.groupsHint : t.groupsEmpty}</Hint>

      <Label>{t.lockScreen}</Label>
      <Segmented
        options={[
          ['all', t.lockAll],
          ['name', t.lockName],
          ['none', t.lockNone],
        ]}
        value={settings.lockScreen}
        onChange={(v) => store.setSettings({ lockScreen: v })}
      />

      <Label>{t.appearance}</Label>
      <Segmented
        options={[
          ['system', t.themeSystem],
          ['light', t.themeLight],
          ['dark', t.themeDark],
        ]}
        value={prefs.theme}
        onChange={(v) => onPref('theme', v)}
      />

      <Label>{t.feb29}</Label>
      <Segmented
        options={[
          ['feb28', t.feb28],
          ['mar1', t.mar1],
        ]}
        value={settings.feb29}
        onChange={(v) => store.setSettings({ feb29: v })}
      />

      <Label>{t.timeZone}</Label>
      <Card>
        <Row icon="public" label={t.homeZone(placeTitle(settings.homeZone, lang))} sub={t.homeZoneSub} chevron onPress={() => setZoneOpen(true)} />
        <Row icon="schedule" label={t.currentZone(zoneCity(env.ctx.myZone))} sub={t.currentZoneSub} last />
      </Card>

      <Label>{t.data}</Label>
      <Card>
        <Row icon="contacts" label={t.importContacts} chevron onPress={onImport} />
        <Row icon="ios-share" label={t.saveBackup} onPress={exportBackup} />
        <Row icon="file-download" label={t.loadBackup} onPress={importBackup} />
        <Row icon="delete-forever" label={t.deleteAll} danger last onPress={confirmReset} disabled={people.length === 0} />
      </Card>

      <Text style={[styles.about, { color: c.text2, fontSize: f(13) }]}>
        {t.appName} {Constants.expoConfig?.version ?? ''} · {t.about}
      </Text>
      <Text style={[styles.about, styles.signature, { color: c.text2, fontSize: f(13) }]}>
        {t.madeBy}{' '}
        <Text style={{ color: c.accentText, fontWeight: '500' }} onPress={() => Linking.openURL(SITE_URL).catch(() => {})} accessibilityRole="link">
          aaron.de
        </Text>
      </Text>
      <Text style={[styles.about, styles.openSource, { color: c.accentText, fontSize: f(13) }]} onPress={() => Linking.openURL(REPO_URL).catch(() => {})} accessibilityRole="link">
        {t.openSource}
      </Text>

      <GroupEditor open={groupEdit.open} id={groupEdit.id} onClose={() => setGroupEdit((g) => ({ ...g, open: false }))} />
      <ZonePicker
        open={zoneOpen}
        value={settings.homeZone}
        onPick={(z) => {
          if (z) store.setSettings({ homeZone: z })
          setZoneOpen(false)
        }}
        onClose={() => setZoneOpen(false)}
      />
    </Sheet>
  )
}


const styles = StyleSheet.create({
  about: { textAlign: 'center', marginTop: 28, lineHeight: 19 },
  signature: { marginTop: 14 },
  openSource: { marginTop: 6, fontWeight: '500' },
})
