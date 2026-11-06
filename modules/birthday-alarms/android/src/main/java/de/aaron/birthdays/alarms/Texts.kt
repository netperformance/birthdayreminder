package de.aaron.birthdays.alarms

import java.time.LocalDate

/** Texte der Benachrichtigungen und des Vollbilds, gleiche Wortwahl wie in src/ui/i18n.ts. */
class Texts(private val lang: String, private val dayFirst: Boolean) {
  private val de = lang != "en"

  fun dayTitle(p: Person, age: Int?): String =
    if (de) (if (age != null) "${p.first} wurde heute $age 🎂" else "${p.first} hat heute Geburtstag 🎂")
    else (if (age != null) "${p.first} turned $age today 🎂" else "It's ${p.first}'s birthday today 🎂")

  /** "In 3 Tagen: Mehmet wird 37", "Morgen: Anna hat Geburtstag" */
  fun preTitle(p: Person, age: Int?, lead: String): String =
    if (de) (if (age != null) "$lead: ${p.first} wird $age" else "$lead: ${p.first} hat Geburtstag")
    else (if (age != null) "$lead: ${p.first} turns $age" else "$lead: ${p.first}'s birthday")

  /** Abstand so, wie er eingestellt ist ("In 2 Wochen"), oder nach Tagen gezählt ("In 4 Tagen"). */
  fun lead(n: Int, unit: Char): String {
    if (n == 1 && unit == 'd') return if (de) "Morgen" else "Tomorrow"
    return if (de) {
      when (unit) {
        'w' -> if (n == 1) "In 1 Woche" else "In $n Wochen"
        'm' -> if (n == 1) "In 1 Monat" else "In $n Monaten"
        else -> "In $n Tagen"
      }
    } else {
      when (unit) {
        'w' -> if (n == 1) "In 1 week" else "In $n weeks"
        'm' -> if (n == 1) "In 1 month" else "In $n months"
        else -> "In $n days"
      }
    }
  }

  fun leadDays(days: Long): String = when {
    days <= 0 -> if (de) "Heute" else "Today"
    days == 1L -> if (de) "Morgen" else "Tomorrow"
    else -> if (de) "In $days Tagen" else "In $days days"
  }

  fun longDate(d: LocalDate): String {
    val wd = (if (de) WEEKDAYS_DE else WEEKDAYS_EN)[d.dayOfWeek.value % 7]
    val mon = (if (de) MONTHS_DE else MONTHS_EN)[d.monthValue - 1]
    return when {
      de -> "$wd, ${d.dayOfMonth}. $mon"
      dayFirst -> "$wd ${d.dayOfMonth} $mon"
      else -> "$wd, $mon ${d.dayOfMonth}"
    }
  }

  val end get() = if (de) "Beenden" else "Done"
  val inOneHour get() = if (de) "In 1 Std." else "In 1 hr"
  val inOneHourLong get() = if (de) "In 1 Stunde erinnern" else "Remind me in 1 hour"
  val tomorrow get() = if (de) "Morgen" else "Tomorrow"
  val open get() = if (de) "Öffnen" else "Open"
  val todayHas get() = if (de) "Heute hat Geburtstag" else "Birthday today"
  /** Vor dem Tag "wird 51", am Geburtstag selbst "wurde 51". */
  fun turns(age: Int?, today: Boolean = false) = if (age == null) "" else if (de) (if (today) "wurde $age" else "wird $age") else (if (today) "turned $age" else "turns $age")
  fun todayCount(n: Int) = if (de) (if (n == 1) "1 Geburtstag heute" else "$n Geburtstage heute") else (if (n == 1) "1 birthday today" else "$n birthdays today")
  fun countShort(n: Int) = if (de) "$n heute" else "$n today"
  val genericToday get() = if (de) "Geburtstag heute" else "Birthday today"
  val genericSoon get() = if (de) "Bald ein Geburtstag" else "A birthday is coming up"
  val channelName get() = if (de) "Erinnerungen" else "Reminders"
  val channelAlarmName get() = if (de) "Erinnerungen im Vollbild" else "Full screen reminders"

  companion object {
    private val WEEKDAYS_DE = listOf("Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag")
    private val WEEKDAYS_EN = listOf("Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday")
    private val MONTHS_DE = listOf("Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember")
    private val MONTHS_EN = listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
  }
}
