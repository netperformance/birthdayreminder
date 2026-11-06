import * as SplashScreen from 'expo-splash-screen'
import * as SQLite from 'expo-sqlite'
import { StatusBar } from 'expo-status-bar'
import * as SystemUI from 'expo-system-ui'
import { useEffect, useRef, useState } from 'react'
import { Appearance, useColorScheme } from 'react-native'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { alarms } from './modules/birthday-alarms'
import { SqliteRepository, type SqlDatabase } from './src/data/sqlite'
import { dayFirstFor } from './src/domain/format'
import { STARTER_GROUPS } from './src/domain/model'
import { BirthdayStore } from './src/store/store'
import { deviceLanguage } from './src/ui/deviceLanguage'
import { EnvProvider } from './src/ui/env'
import { LangContext, LanguageContext, STRINGS } from './src/ui/i18n'
import { MainScreen } from './src/ui/MainScreen'
import { buildPayload } from './src/ui/payload'
import { cleanupPhotos } from './src/ui/photos'
import { FONT_STEPS, loadPrefs, PREF_KEYS, savePref, type Prefs } from './src/ui/prefs'
import { SnackbarProvider } from './src/ui/Snackbar'
import { dark, FontScaleContext, light, ThemeContext, type ThemeMode } from './src/ui/theme'
import { StoreContext } from './src/ui/useStore'
import { useSyncExternalStore } from 'react'

SplashScreen.preventAutoHideAsync().catch(() => {})

type Boot = { store: BirthdayStore; repo: SqliteRepository; prefs: Prefs }

async function boot(): Promise<Boot> {
  const db = await SQLite.openDatabaseAsync('birthdays.db')
  const repo = new SqliteRepository(db as unknown as SqlDatabase)
  const prefs = await loadPrefs(repo, deviceLanguage())
  const store = await BirthdayStore.open(repo, { deviceZone: alarms.currentZone(), starterGroups: STARTER_GROUPS[prefs.language] })
  applyColorScheme(prefs.theme)
  // Bilder gelöschter Einträge aufräumen (nach dem Start, nicht vor dem ersten Bild)
  setTimeout(() => cleanupPhotos(store.photosInUse()), 3000)
  return { store, repo, prefs }
}

/** Stellt Android auf die gewählte Darstellung ein, damit auch die Dialoge des Systems passen. */
function applyColorScheme(theme: ThemeMode): void {
  try {
    Appearance.setColorScheme(theme === 'system' ? 'unspecified' : theme)
  } catch {
    /* ältere Android-Version: die App färbt sich trotzdem selbst */
  }
}

export default function App() {
  const [state, setState] = useState<Boot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const system = useColorScheme()

  useEffect(() => {
    boot()
      .then((b) => {
        setState(b)
        setPrefs(b.prefs)
      })
      .catch((e) => setError(String(e)))
      .finally(() => SplashScreen.hideAsync().catch(() => {}))
  }, [])

  const theme = prefs?.theme ?? 'light'
  const isDark = theme === 'dark' || (theme === 'system' && system === 'dark')
  const colors = isDark ? dark : light

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {})
  }, [colors.bg])

  if (error) throw new Error(`Start fehlgeschlagen: ${error}`)
  if (!state || !prefs) return null

  const change = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => (p ? { ...p, [key]: value } : p))
    if (key === 'theme') applyColorScheme(value as ThemeMode)
    savePref(state.repo, key, value)
  }

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={colors}>
        <FontScaleContext.Provider value={FONT_STEPS[prefs.fontStep] ?? 1}>
          <LangContext.Provider value={prefs.language}>
            <LanguageContext.Provider value={STRINGS[prefs.language]}>
              <StoreContext.Provider value={state.store}>
                <Root store={state.store} prefs={prefs} onPref={change} />
              </StoreContext.Provider>
            </LanguageContext.Provider>
          </LangContext.Provider>
        </FontScaleContext.Provider>
      </ThemeContext.Provider>
    </SafeAreaProvider>
  )
}

/** Hält das Erinnerungsmodul auf dem Stand und öffnet Einträge aus angetippten Benachrichtigungen. */
function Root({ store, prefs, onPref }: { store: BirthdayStore; prefs: Prefs; onPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void }) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const [openRequest, setOpenRequest] = useState<{ id: string; n: number } | null>(null)
  const counter = useRef(0)
  const dayFirst = prefs.language === 'de' ? true : dayFirstFor(alarms.locale())
  const isDark = prefs.theme === 'dark'

  useEffect(() => {
    const timer = setTimeout(() => alarms.sync(buildPayload(snapshot.people, snapshot.settings, prefs.language, dayFirst)), 400)
    return () => clearTimeout(timer)
  }, [snapshot, prefs.language, dayFirst])

  useEffect(() => {
    const first = alarms.launchPerson()
    if (first) setOpenRequest({ id: first, n: ++counter.current })
    return alarms.onOpenPerson((id) => setOpenRequest({ id, n: ++counter.current }))
  }, [])

  return (
    <EnvProvider settings={snapshot.settings} lang={prefs.language}>
      <SnackbarProvider>
        <StatusBar style={isDark ? 'light' : 'auto'} />
        <MainScreen prefs={prefs} onPref={onPref} keepOnReset={PREF_KEYS} openRequest={openRequest} />
      </SnackbarProvider>
    </EnvProvider>
  )
}
