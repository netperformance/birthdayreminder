package de.aaron.birthdays.alarms

import java.time.Instant
import java.time.LocalDate
import java.time.Year
import java.time.ZoneId

/**
 * Wann ein Geburtstag ist und wann seine Erinnerungen kommen. Dieselben Regeln stehen in
 * TypeScript in src/domain/schedule.ts und sind dort mit Tests abgesichert.
 *
 * - Ein Geburtstag dauert von 00:00 bis 24:00 in der Zeitzone der Person (ohne eigene: Zuhause).
 * - "Am Tag" kommt zur Uhrzeit in der Zeit der Person. Liegt sie bei dir in der Nacht (22 bis 7 Uhr)
 *   und unterscheiden sich die Zonen, kommt sie um 07:00 bei dir, solange der Geburtstag noch läuft.
 * - Vorab-Erinnerungen kommen zur Uhrzeit in deiner Ortszeit.
 * - Fehlt eine Uhrzeit wegen der Sommerzeit (02:30), gilt der Moment der Umstellung (03:00).
 *   Gibt es sie zweimal (Herbst), gilt die erste.
 */
class Planner(private val payload: Payload, private val mine: ZoneId = ZoneId.systemDefault()) {

  data class Occ(val person: Person, val rem: Rem, val at: Instant, val day: LocalDate, val end: Instant)

  fun zoneOf(p: Person): ZoneId = if (p.zone.isNullOrBlank()) payload.homeZone else Payload.zoneOrDefault(p.zone)

  fun birthdayIn(year: Int, p: Person): LocalDate {
    if (p.month == 2 && p.day == 29 && !Year.isLeap(year.toLong())) {
      return if (payload.feb29Mar1) LocalDate.of(year, 3, 1) else LocalDate.of(year, 2, 28)
    }
    return LocalDate.of(year, p.month, p.day)
  }

  private fun exists(p: Person, year: Int) = p.year == null || year > p.year

  fun end(p: Person, day: LocalDate): Instant = instantOf(day.plusDays(1), 0, zoneOf(p))

  fun occurrence(p: Person, r: Rem, year: Int): Occ {
    val day = birthdayIn(year, p)
    val zone = zoneOf(p)
    val end = end(p, day)
    if (r.n > 0) {
      val d = when (r.unit) {
        'w' -> day.minusWeeks(r.n.toLong())
        'm' -> day.minusMonths(r.n.toLong())
        else -> day.minusDays(r.n.toLong())
      }
      return Occ(p, r, instantOf(d, r.minute, mine), day, end)
    }
    val t = instantOf(day, r.minute, zone)
    if (zone.rules.getOffset(t) == mine.rules.getOffset(t)) return Occ(p, r, t, day, end)
    val local = t.atZone(mine).toLocalDateTime()
    val m = local.hour * 60 + local.minute
    if (m >= NIGHT_START || m < NIGHT_END) {
      val morning = if (m >= NIGHT_START) local.toLocalDate().plusDays(1) else local.toLocalDate()
      val shifted = instantOf(morning, NIGHT_END, mine)
      if (shifted.isBefore(end)) return Occ(p, r, shifted, day, end)
    }
    return Occ(p, r, t, day, end)
  }

  /** Alle Zeitpunkte einer Erinnerung im Zeitraum (from, to]. */
  fun between(p: Person, r: Rem, from: Instant, to: Instant): List<Occ> {
    val y0 = from.atZone(zoneOf(p)).year - 1
    val y1 = to.atZone(zoneOf(p)).year + 2
    val out = mutableListOf<Occ>()
    for (y in y0..y1) {
      if (!exists(p, y)) continue
      val o = occurrence(p, r, y)
      if (o.at.isAfter(from) && !o.at.isAfter(to)) out += o
    }
    return out
  }

  fun next(p: Person, r: Rem, after: Instant): Occ? {
    val y = after.atZone(zoneOf(p)).year
    var best: Occ? = null
    for (year in (y - 1)..(y + 2)) {
      if (!exists(p, year)) continue
      val o = occurrence(p, r, year)
      if (o.at.isAfter(after) && (best == null || o.at.isBefore(best.at))) best = o
    }
    return best
  }

  /** Der Geburtstag, der gerade läuft, oder null. */
  fun running(p: Person, now: Instant): LocalDate? {
    val y = now.atZone(zoneOf(p)).year
    for (year in (y - 1)..(y + 1)) {
      if (!exists(p, year)) continue
      val day = birthdayIn(year, p)
      val start = instantOf(day, 0, zoneOf(p))
      if (!now.isBefore(start) && now.isBefore(end(p, day))) return day
    }
    return null
  }

  companion object {
    const val NIGHT_START = 22 * 60
    const val NIGHT_END = 7 * 60

    fun instantOf(day: LocalDate, minute: Int, zone: ZoneId): Instant {
      val ldt = day.atStartOfDay().plusMinutes(minute.toLong())
      val rules = zone.rules
      val offsets = rules.getValidOffsets(ldt)
      if (offsets.isEmpty()) return rules.getTransition(ldt).instant
      return offsets.map { ldt.toInstant(it) }.minOrNull()!!
    }
  }
}
