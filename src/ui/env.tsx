import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppState } from 'react-native'
import { alarms, type DoneMap } from '../../modules/birthday-alarms'
import { dayFirstFor, type DateStyle } from '../domain/format'
import type { Lang } from '../domain/lang'
import type { Settings } from '../domain/model'
import type { ScheduleContext } from '../domain/schedule'

/**
 * Was viele Bildschirme brauchen und sich mit der Zeit ändert: die aktuelle Uhrzeit (jede
 * halbe Minute neu), die Zeitzone des Handys, das Datumsformat und wer heute schon "Beenden"
 * bekommen hat. Neu gelesen wird auch, wenn die App wieder in den Vordergrund kommt.
 */
export interface Env {
  now: number
  ctx: ScheduleContext
  style: DateStyle
  done: DoneMap
  refresh: () => void
}

const EnvContext = createContext<Env | null>(null)

export function useEnv(): Env {
  const env = useContext(EnvContext)
  if (!env) throw new Error('Env fehlt')
  return env
}

export function EnvProvider({ settings, lang, children }: { settings: Settings; lang: Lang; children: ReactNode }) {
  const [now, setNow] = useState(Date.now())
  const [myZone, setMyZone] = useState(() => alarms.currentZone())
  const [done, setDone] = useState<DoneMap>(() => alarms.done())
  const [h24, setH24] = useState(() => alarms.is24Hour())
  const [locale] = useState(() => alarms.locale())

  const refresh = useCallback(() => {
    setNow(Date.now())
    setMyZone(alarms.currentZone())
    setDone(alarms.done())
    setH24(alarms.is24Hour())
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      setMyZone((z) => {
        const current = alarms.currentZone()
        return current === z ? z : current
      })
    }, 30_000)
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh())
    return () => {
      clearInterval(timer)
      sub.remove()
    }
  }, [refresh])

  const value = useMemo<Env>(
    () => ({
      now,
      ctx: { homeZone: settings.homeZone, myZone, feb29: settings.feb29, info: alarms.zoneInfo },
      style: { lang, dayFirst: lang === 'de' ? true : dayFirstFor(locale), h24: lang === 'de' ? true : h24 },
      done,
      refresh,
    }),
    [now, settings.homeZone, settings.feb29, myZone, lang, locale, h24, done, refresh],
  )
  return <EnvContext.Provider value={value}>{children}</EnvContext.Provider>
}
