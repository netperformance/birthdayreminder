package de.aaron.birthdays.alarms

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * Prüft fällige Erinnerungen, zeigt sie und stellt den Wecker von Android auf die nächste.
 *
 * Es gibt immer nur einen Wecker: den für die nächste fällige Erinnerung. Beim Klingeln
 * prüft run(), was seit dem letzten Lauf fällig war, und stellt den nächsten. Dasselbe passiert,
 * wenn die App Änderungen schickt, nach einem Neustart und nach einem Wechsel der Zeitzone
 * oder der Uhrzeit. So kommt auch eine Erinnerung, über die die Uhr beim Landen gesprungen
 * ist, sofort nach, solange der Geburtstag noch läuft.
 */
object Scheduler {
  private const val REQUEST = 4711
  /** Kleine Vorlaufzeit, falls Android den Wecker ein paar Sekunden zu früh auslöst. */
  private const val EARLY_MS = 30_000L

  @Synchronized
  fun run(context: Context) {
    val store = Store(context)
    val payload = store.payload()
    if (payload == null) {
      cancelAlarm(context)
      return
    }
    val now = Instant.now()
    var last = Instant.ofEpochMilli(store.lastRun ?: now.toEpochMilli())
    // Uhr zurückgestellt: ab jetzt neu zählen, sonst käme bis zum alten Stand keine Erinnerung.
    if (last.isAfter(now.plusSeconds(60))) last = now
    val planner = Planner(payload)
    val dues = mutableListOf<Notifier.Due>()

    if (payload.enabled && now.isAfter(last.minusMillis(1))) {
      val until = now.plusMillis(EARLY_MS)
      for (p in payload.people) {
        for (r in p.reminders) {
          for (o in planner.between(p, r, last, until)) {
            if (!now.isBefore(o.end)) continue // Geburtstag schon vorbei: nicht mehr nachholen
            if (r.n == 0 && store.isDone(p.id, o.day)) continue
            // Verspätet (Handy aus, Flug): Abstand nach Tagen zählen statt "In 3 Tagen" aus der Einstellung
            val late = now.toEpochMilli() - o.at.toEpochMilli() > 3_600_000
            dues += Notifier.Due(p, r.n, r.unit, r.fullscreen, r.hint, o.day, snoozed = late)
          }
        }
      }
      val keep = mutableListOf<Store.Snooze>()
      for (s in store.snoozes()) {
        val p = payload.person(s.personId)
        if (p == null) continue
        if (s.at > until.toEpochMilli()) {
          keep += s
          continue
        }
        val day = runCatching { LocalDate.parse(s.date) }.getOrNull() ?: continue
        if (s.n == 0 && store.isDone(p.id, day)) continue
        dues += Notifier.Due(p, s.n, 'd', s.fullscreen, s.hint, day, snoozed = true)
      }
      store.setSnoozes(keep)
    }

    // Je Person nur eine Benachrichtigung: "am Tag" vor Vorab, Vollbild vor Popup.
    val chosen = dues.groupBy { it.person.id }.values.map { list ->
      list.sortedWith(compareBy<Notifier.Due>({ it.n != 0 }, { !it.fullscreen })).first()
    }
    Notifier.post(context, payload, chosen)
    store.lastRun = maxOf(now, last).plusMillis(if (dues.isEmpty()) 0 else EARLY_MS).toEpochMilli()
    scheduleNext(context, payload, store)
  }

  private fun scheduleNext(context: Context, payload: Payload, store: Store) {
    if (!payload.enabled) {
      cancelAlarm(context)
      return
    }
    val after = Instant.ofEpochMilli(store.lastRun ?: System.currentTimeMillis())
    val planner = Planner(payload, ZoneId.systemDefault())
    var next: Instant? = null
    for (p in payload.people) for (r in p.reminders) {
      val o = planner.next(p, r, after) ?: continue
      if (next == null || o.at.isBefore(next)) next = o.at
    }
    for (s in store.snoozes()) {
      val at = Instant.ofEpochMilli(s.at)
      if (next == null || at.isBefore(next)) next = at
    }
    if (next == null) {
      cancelAlarm(context)
      return
    }
    val am = context.getSystemService(AlarmManager::class.java) ?: return
    val pi = alarmIntent(context)
    val at = maxOf(next.toEpochMilli(), System.currentTimeMillis() + 1000)
    try {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
      } else {
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
      }
    } catch (_: SecurityException) {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }
  }

  private fun alarmIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      REQUEST,
      Intent(context, AlarmReceiver::class.java).setAction("de.aaron.birthdays.FIRE"),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  private fun cancelAlarm(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(alarmIntent(context))
  }
}
