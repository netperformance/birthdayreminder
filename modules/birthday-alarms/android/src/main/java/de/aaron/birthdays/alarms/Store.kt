package de.aaron.birthdays.alarms

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/**
 * Was das Modul sich merkt, in den SharedPreferences der App:
 * - payload: Einträge und Einstellungen aus der App
 * - lastRun: bis wann Erinnerungen schon geprüft wurden
 * - done: wer heute schon "Beenden" bekommen hat (Person -> Geburtstag und Uhrzeit)
 * - snoozes: verschobene Erinnerungen ("In 1 Std.", "Morgen")
 */
class Store(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("birthday_alarms", Context.MODE_PRIVATE)

  var payloadJson: String?
    get() = prefs.getString("payload", null)
    set(value) = prefs.edit().putString("payload", value).apply()

  fun payload(): Payload? = payloadJson?.let { Payload.parse(it) }

  var lastRun: Long?
    get() = if (prefs.contains("lastRun")) prefs.getLong("lastRun", 0) else null
    set(value) {
      val e = prefs.edit()
      if (value == null) e.remove("lastRun") else e.putLong("lastRun", value)
      e.apply()
    }

  // ---------- Beenden ----------

  fun doneJson(): String = prefs.getString("done", "{}") ?: "{}"

  fun isDone(personId: String, day: LocalDate): Boolean {
    val o = JSONObject(doneJson())
    val entry = o.optJSONObject(personId) ?: return false
    return entry.optString("date") == day.toString()
  }

  fun markDone(personId: String, date: String, at: Long) {
    val o = JSONObject(doneJson())
    o.put(personId, JSONObject().put("date", date).put("at", at))
    // Alte Einträge (älter als ein Jahr) aufräumen
    val cutoff = LocalDate.now().minusDays(400).toString()
    val stale = mutableListOf<String>()
    for (k in o.keys()) if ((o.optJSONObject(k)?.optString("date") ?: "") < cutoff) stale += k
    stale.forEach { o.remove(it) }
    prefs.edit().putString("done", o.toString()).commit()
  }

  // ---------- Verschoben ----------

  data class Snooze(val personId: String, val at: Long, val n: Int, val fullscreen: Boolean, val hint: String, val date: String)

  fun snoozes(): List<Snooze> {
    val arr = JSONArray(prefs.getString("snoozes", "[]") ?: "[]")
    return (0 until arr.length()).map {
      val o = arr.getJSONObject(it)
      Snooze(o.getString("personId"), o.getLong("at"), o.optInt("n"), o.optBoolean("fullscreen"), o.optString("hint"), o.optString("date"))
    }
  }

  fun setSnoozes(list: List<Snooze>) {
    val arr = JSONArray()
    for (s in list) {
      arr.put(JSONObject().put("personId", s.personId).put("at", s.at).put("n", s.n).put("fullscreen", s.fullscreen).put("hint", s.hint).put("date", s.date))
    }
    prefs.edit().putString("snoozes", arr.toString()).commit()
  }

  fun addSnooze(s: Snooze) = setSnoozes(snoozes().filter { it.personId != s.personId } + s)

  fun removeSnoozes(personId: String) = setSnoozes(snoozes().filter { it.personId != personId })
}
