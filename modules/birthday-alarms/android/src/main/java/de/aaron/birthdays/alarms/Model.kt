package de.aaron.birthdays.alarms

import org.json.JSONObject
import java.time.ZoneId

/**
 * Was die App dem Modul bei jeder Änderung schickt (siehe modules/birthday-alarms/index.ts,
 * Typ AlarmPayload). Das Modul plant daraus alle Erinnerungen selbst, auch wenn die App
 * geschlossen ist, nach einem Neustart und nach einem Wechsel der Zeitzone.
 */
data class Rem(
  val n: Int,
  /** 'd', 'w' oder 'm' */
  val unit: Char,
  val minute: Int,
  val popup: Boolean,
  val fullscreen: Boolean,
  val hint: String,
)

data class Person(
  val id: String,
  val name: String,
  val day: Int,
  val month: Int,
  val year: Int?,
  val zone: String?,
  val note: String,
  val sign: String,
  val photo: String,
  val reminders: List<Rem>,
) {
  /** Vorname für kurze Titel ("Lisa wurde heute 34"). */
  val first: String get() = name.trim().split(Regex("\\s+")).firstOrNull()?.ifBlank { null } ?: name
}

data class Payload(
  val enabled: Boolean,
  val lang: String,
  val dayFirst: Boolean,
  val homeZone: ZoneId,
  val feb29Mar1: Boolean,
  /** "all", "name" oder "none" */
  val lockScreen: String,
  val people: List<Person>,
) {
  fun person(id: String) = people.firstOrNull { it.id == id }

  companion object {
    fun parse(json: String): Payload? =
      try {
        val o = JSONObject(json)
        val people = mutableListOf<Person>()
        val arr = o.optJSONArray("people")
        if (arr != null) {
          for (i in 0 until arr.length()) {
            val p = arr.getJSONObject(i)
            val rems = mutableListOf<Rem>()
            val ra = p.optJSONArray("reminders")
            if (ra != null) {
              for (j in 0 until ra.length()) {
                val r = ra.getJSONObject(j)
                rems += Rem(
                  n = r.optInt("n", 0),
                  unit = r.optString("unit", "d").firstOrNull() ?: 'd',
                  minute = r.optInt("minute", 540),
                  popup = r.optBoolean("popup", true),
                  fullscreen = r.optBoolean("fullscreen", false),
                  hint = r.optString("hint", ""),
                )
              }
            }
            people += Person(
              id = p.getString("id"),
              name = p.optString("name", ""),
              day = p.getInt("day"),
              month = p.getInt("month"),
              year = if (p.isNull("year") || !p.has("year")) null else p.getInt("year"),
              zone = if (p.isNull("zone") || !p.has("zone")) null else p.getString("zone"),
              note = p.optString("note", ""),
              sign = p.optString("sign", ""),
              photo = p.optString("photo", ""),
              reminders = rems,
            )
          }
        }
        Payload(
          enabled = o.optBoolean("enabled", true),
          lang = if (o.optString("lang") == "en") "en" else "de",
          dayFirst = o.optBoolean("dayFirst", true),
          homeZone = zoneOrDefault(o.optString("homeZone", "")),
          feb29Mar1 = o.optString("feb29") == "mar1",
          lockScreen = o.optString("lockScreen", "all"),
          people = people,
        )
      } catch (_: Exception) {
        null
      }

    fun zoneOrDefault(id: String?): ZoneId =
      try {
        if (id.isNullOrBlank()) ZoneId.systemDefault() else ZoneId.of(id)
      } catch (_: Exception) {
        ZoneId.systemDefault()
      }
  }
}
