import type { Lang } from './lang'

export type Sign =
  | 'aries'
  | 'taurus'
  | 'gemini'
  | 'cancer'
  | 'leo'
  | 'virgo'
  | 'libra'
  | 'scorpio'
  | 'sagittarius'
  | 'capricorn'
  | 'aquarius'
  | 'pisces'

/** Erster Tag jedes Zeichens als [Monat, Tag], in Kalenderreihenfolge ab Januar. */
const STARTS: [Sign, number, number][] = [
  ['capricorn', 1, 1],
  ['aquarius', 1, 20],
  ['pisces', 2, 19],
  ['aries', 3, 21],
  ['taurus', 4, 20],
  ['gemini', 5, 21],
  ['cancer', 6, 21],
  ['leo', 7, 23],
  ['virgo', 8, 23],
  ['libra', 9, 23],
  ['scorpio', 10, 23],
  ['sagittarius', 11, 22],
  ['capricorn', 12, 22],
]

/** Westliches Sternzeichen. Die Grenzen schwanken je nach Quelle um einen Tag, hier die übliche Einteilung. */
export function signOf(month: number, day: number): Sign {
  let sign: Sign = 'capricorn'
  for (const [s, m, d] of STARTS) if (month > m || (month === m && day >= d)) sign = s
  return sign
}

/** Symbol mit Textdarstellung (U+FE0E), damit Android kein buntes Emoji zeigt. */
export const SYMBOLS: Record<Sign, string> = {
  aries: '♈︎',
  taurus: '♉︎',
  gemini: '♊︎',
  cancer: '♋︎',
  leo: '♌︎',
  virgo: '♍︎',
  libra: '♎︎',
  scorpio: '♏︎',
  sagittarius: '♐︎',
  capricorn: '♑︎',
  aquarius: '♒︎',
  pisces: '♓︎',
}

export const SIGN_NAMES: Record<Lang, Record<Sign, string>> = {
  de: {
    aries: 'Widder',
    taurus: 'Stier',
    gemini: 'Zwillinge',
    cancer: 'Krebs',
    leo: 'Löwe',
    virgo: 'Jungfrau',
    libra: 'Waage',
    scorpio: 'Skorpion',
    sagittarius: 'Schütze',
    capricorn: 'Steinbock',
    aquarius: 'Wassermann',
    pisces: 'Fische',
  },
  en: {
    aries: 'Aries',
    taurus: 'Taurus',
    gemini: 'Gemini',
    cancer: 'Cancer',
    leo: 'Leo',
    virgo: 'Virgo',
    libra: 'Libra',
    scorpio: 'Scorpio',
    sagittarius: 'Sagittarius',
    capricorn: 'Capricorn',
    aquarius: 'Aquarius',
    pisces: 'Pisces',
  },
}
