import { describe, expect, it } from 'vitest'
import { addMonths, birthdaysInMonth, monthGrid } from './calendar'

describe('Kalenderansicht', () => {
  it('beginnt die Woche am Montag', () => {
    const nov = monthGrid({ year: 2026, month: 11 }) // 1. November 2026 ist ein Sonntag
    expect(nov.slice(0, 7)).toEqual([null, null, null, null, null, null, 1])
    expect(nov.length % 7).toBe(0)
    expect(nov.filter((d) => d !== null)).toHaveLength(30)
    const feb = monthGrid({ year: 2027, month: 2 }) // 1. Februar 2027 ist ein Montag
    expect(feb[0]).toBe(1)
    expect(feb).toHaveLength(28)
  })

  it('blättert über den Jahreswechsel', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(addMonths({ year: 2026, month: 11 }, -23)).toEqual({ year: 2024, month: 12 })
  })

  it('ordnet Geburtstage den Tagen zu', () => {
    const people = [
      { id: 'a', day: 14, month: 11 },
      { id: 'b', day: 27, month: 11 },
      { id: 'c', day: 27, month: 11 },
      { id: 'd', day: 1, month: 12 },
    ]
    const map = birthdaysInMonth(people, { year: 2026, month: 11 }, 'feb28')
    expect([...map.keys()].sort((x, y) => x - y)).toEqual([14, 27])
    expect(map.get(27)?.map((p) => p.id)).toEqual(['b', 'c'])
  })

  it('verschiebt den 29. Februar nach der Einstellung', () => {
    const leap = [{ day: 29, month: 2 }]
    expect([...birthdaysInMonth(leap, { year: 2027, month: 2 }, 'feb28').keys()]).toEqual([28])
    expect(birthdaysInMonth(leap, { year: 2027, month: 2 }, 'mar1').size).toBe(0)
    expect([...birthdaysInMonth(leap, { year: 2027, month: 3 }, 'mar1').keys()]).toEqual([1])
    expect([...birthdaysInMonth(leap, { year: 2028, month: 2 }, 'mar1').keys()]).toEqual([29])
  })
})
