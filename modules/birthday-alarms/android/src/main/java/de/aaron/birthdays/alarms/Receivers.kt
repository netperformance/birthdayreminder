package de.aaron.birthdays.alarms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Der Wecker von Android klingelt: fällige Erinnerungen zeigen, nächste planen. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Scheduler.run(context)
  }
}

/** Neustart, neue Zeitzone, geänderte Uhrzeit, Update der App: alles neu planen. */
class SystemReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    Scheduler.run(context)
  }
}

/** Knöpfe in der Benachrichtigung: Beenden, In 1 Std., Morgen. */
class ActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val person = intent.getStringExtra(EXTRA_PERSON) ?: return
    val date = intent.getStringExtra(EXTRA_DATE) ?: ""
    val n = intent.getIntExtra(EXTRA_N, 0)
    val fullscreen = intent.getBooleanExtra(EXTRA_FULLSCREEN, false)
    val hint = intent.getStringExtra(EXTRA_HINT) ?: ""
    when (intent.action) {
      DONE -> Actions.done(context, person, date)
      DISMISS -> Actions.dismiss(context, person)
      SNOOZE_HOUR -> Actions.snooze(context, person, date, n, fullscreen, hint, 60 * 60 * 1000L)
      SNOOZE_DAY -> Actions.snooze(context, person, date, n, fullscreen, hint, 24 * 60 * 60 * 1000L)
    }
  }

  companion object {
    const val DONE = "de.aaron.birthdays.DONE"
    const val DISMISS = "de.aaron.birthdays.DISMISS"
    const val SNOOZE_HOUR = "de.aaron.birthdays.SNOOZE_HOUR"
    const val SNOOZE_DAY = "de.aaron.birthdays.SNOOZE_DAY"
    const val EXTRA_PERSON = "person"
    const val EXTRA_DATE = "date"
    const val EXTRA_N = "n"
    const val EXTRA_FULLSCREEN = "fullscreen"
    const val EXTRA_HINT = "hint"
  }
}

/** Was die Knöpfe tun. Auch die App ruft done() auf, wenn auf der Karte "Beenden" getippt wird. */
object Actions {
  /** "Beenden": Person für diesen Geburtstag abhaken. Lässt sich nicht zurücknehmen. */
  fun done(context: Context, personId: String, date: String) {
    val store = Store(context)
    store.markDone(personId, date, System.currentTimeMillis())
    store.removeSnoozes(personId)
    Notifier.cancel(context, personId)
    AlarmActivity.closeFor(personId)
    Scheduler.run(context)
  }

  /** "Beenden" bei einer Vorab-Erinnerung: nur die Benachrichtigung schließen. */
  fun dismiss(context: Context, personId: String) {
    Notifier.cancel(context, personId)
    AlarmActivity.closeFor(personId)
  }

  fun snooze(context: Context, personId: String, date: String, n: Int, fullscreen: Boolean, hint: String, delayMs: Long) {
    val store = Store(context)
    store.addSnooze(Store.Snooze(personId, System.currentTimeMillis() + delayMs, n, fullscreen, hint, date))
    Notifier.cancel(context, personId)
    AlarmActivity.closeFor(personId)
    Scheduler.run(context)
  }
}
