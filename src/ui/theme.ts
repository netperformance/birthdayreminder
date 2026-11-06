import { createContext, useContext } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

export interface Palette {
  dark: boolean
  bg: string
  card: string
  cardPressed: string
  text: string
  text2: string
  text3: string
  sep: string
  /** Pastellrosa für Flächen: Knöpfe, Auswahl. Schrift darauf in onAccent. */
  accent: string
  onAccent: string
  /** Dunkleres Rosa für Links und kleine Symbole, damit sie lesbar bleiben. */
  accentText: string
  /** Sehr helles Rosa für Hinweisflächen (Tage bis zum Geburtstag, Vorschau). */
  accentSoft: string
  /** Schrift auf accentSoft. */
  accentDeep: string
  switchOn: string
  danger: string
  ok: string
  backdrop: string
  snackbar: string
  snackbarText: string
  snackbarAction: string
  ripple: string
  todayBg: string
  todayBorder: string
  todayText: string
  todayNote: string
  pauseBg: string
  pauseText: string
  pauseSub: string
  mark: string
  gray: string
}

export const light: Palette = {
  dark: false,
  bg: '#f7f5f6',
  card: '#ffffff',
  cardPressed: '#f1ecee',
  text: '#18161a',
  text2: '#646068',
  text3: '#a8a3ab',
  sep: 'rgba(0,0,0,0.08)',
  accent: '#f4b4cb',
  onAccent: '#5c1733',
  accentText: '#b8487a',
  accentSoft: '#fde8f0',
  accentDeep: '#8f2f5b',
  switchOn: '#ee9dbb',
  danger: '#d93838',
  ok: '#1f9d5c',
  backdrop: 'rgba(0,0,0,0.32)',
  snackbar: '#2e2a2c',
  snackbarText: '#f4f0f2',
  snackbarAction: '#ff9cc1',
  ripple: 'rgba(0,0,0,0.08)',
  todayBg: '#fde6ef',
  todayBorder: 'rgba(184,72,122,0.14)',
  todayText: '#8f2f5b',
  todayNote: '#5c3446',
  pauseBg: '#fff3d1',
  pauseText: '#6b4300',
  pauseSub: '#8a5a10',
  mark: '#ffe58a',
  gray: 'rgba(0,0,0,0.05)',
}

export const dark: Palette = {
  dark: true,
  bg: '#110f10',
  card: '#1f1c1d',
  cardPressed: '#2a2627',
  text: '#f2eef0',
  text2: '#aaa3a7',
  text3: '#6c656a',
  sep: 'rgba(255,255,255,0.08)',
  accent: '#f0a8c2',
  onAccent: '#3d0a1f',
  accentText: '#f4afc8',
  accentSoft: 'rgba(240,168,194,0.14)',
  accentDeep: '#f7c3d6',
  switchOn: '#e88fb1',
  danger: '#ff6b6b',
  ok: '#9ee6bd',
  backdrop: 'rgba(0,0,0,0.55)',
  snackbar: '#ece6e9',
  snackbarText: '#1c191b',
  snackbarAction: '#a33a6a',
  ripple: 'rgba(255,255,255,0.1)',
  todayBg: '#36202b',
  todayBorder: 'rgba(255,255,255,0.05)',
  todayText: '#f4b9cf',
  todayNote: '#e7c6d4',
  pauseBg: '#3a3018',
  pauseText: '#ffd98a',
  pauseSub: '#e6c27a',
  mark: 'rgba(255,214,10,0.35)',
  gray: 'rgba(255,255,255,0.08)',
}

/** Farben der Kreise mit Anfangsbuchstaben, in Hell und Dunkel gut lesbar mit weißer Schrift. */
export const AVATAR_COLORS = ['#e5484d', '#ef6c1a', '#c98a00', '#5aa832', '#1f9d5c', '#12a594', '#2f6fe4', '#3e63dd', '#8e4ec6', '#d6409f', '#978365', '#8b8d98']

export function avatarColor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export const ThemeContext = createContext<Palette>(light)
export const useColors = () => useContext(ThemeContext)

/** Faktor für alle Schriftgrößen der App (Schalter A− und A+). */
export const FontScaleContext = createContext(1)

export function useFont(): (size: number) => number {
  const scale = useContext(FontScaleContext)
  return (size: number) => Math.round(size * scale * 10) / 10
}
