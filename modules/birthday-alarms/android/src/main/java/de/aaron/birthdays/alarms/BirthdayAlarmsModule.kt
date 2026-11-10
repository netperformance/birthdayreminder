package de.aaron.birthdays.alarms

import android.app.AlarmManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.text.format.DateFormat
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.time.Instant
import java.time.ZoneId
import java.util.Locale

/**
 * Verbindung zwischen App und Android für die Erinnerungen.
 *
 * - sync: Die App schickt bei jeder Änderung alle Einträge und Einstellungen. Das Modul plant
 *   daraus die Erinnerungen selbst (Scheduler), auch wenn die App geschlossen ist.
 * - Zeitzonen: Die Regeln für Sommerzeit und Abstände kommen von Android (java.time).
 * - Erlaubnisse: Zustand abfragen und die passende Seite der Android-Einstellungen öffnen.
 */
class BirthdayAlarmsModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("Kein Kontext")

  override fun definition() = ModuleDefinition {
    Name("BirthdayAlarms")

    Events("onOpenPerson")

    Function("sync") { json: String ->
      val store = Store(context)
      store.payloadJson = json
      // Nur jüngst Verpasstes nachholen: Änderungen in der App lösen keine alten Erinnerungen aus.
      val floor = System.currentTimeMillis() - 2 * 60 * 1000L
      if ((store.lastRun ?: 0L) < floor) store.lastRun = floor
      Scheduler.run(context)
    }

    Function("getDone") { Store(context).doneJson() }

    Function("markDone") { personId: String, date: String ->
      Actions.done(context, personId, date)
    }

    Function("currentZone") { ZoneId.systemDefault().id }

    Function("offsetMinutes") { zone: String, epochMs: Double ->
      try {
        ZoneId.of(zone).rules.getOffset(Instant.ofEpochMilli(epochMs.toLong())).totalSeconds / 60
      } catch (_: Exception) {
        ZoneId.systemDefault().rules.getOffset(Instant.ofEpochMilli(epochMs.toLong())).totalSeconds / 60
      }
    }

    Function("zones") {
      ZoneId.getAvailableZoneIds()
        .filter { it.contains('/') && !it.startsWith("Etc/") && !it.startsWith("SystemV/") && !it.startsWith("US/") && it[0].isUpperCase() }
        .sorted()
    }

    Function("is24Hour") { DateFormat.is24HourFormat(context) }

    Function("locale") { Locale.getDefault().toLanguageTag() }

    Function("permissions") {
      val nm = context.getSystemService(NotificationManager::class.java)
      val am = context.getSystemService(AlarmManager::class.java)
      val pm = context.getSystemService(PowerManager::class.java)
      mapOf(
        "notifications" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
        "exact" to (Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am?.canScheduleExactAlarms() == true),
        "fullscreen" to (Build.VERSION.SDK_INT < 34 || nm?.canUseFullScreenIntent() == true),
        "battery" to (pm?.isIgnoringBatteryOptimizations(context.packageName) == true),
      )
    }

    AsyncFunction("openSettings") { kind: String ->
      val pkg = context.packageName
      val intent = when (kind) {
        "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, pkg)
        "exact" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:$pkg")) else null
        "fullscreen" -> if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$pkg")) else null
        // Liste aller Apps statt Rückfrage: Die direkte Rückfrage (REQUEST_IGNORE_BATTERY_OPTIMIZATIONS)
        // erlaubt Google Play nur Apps, deren Kernfunktion ohne sie nicht geht.
        "battery" -> Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
        else -> null
      } ?: Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg"))
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        (appContext.currentActivity ?: context).startActivity(intent)
        true
      } catch (_: Exception) {
        try {
          context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$pkg")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          true
        } catch (_: Exception) {
          false
        }
      }
    }

    /** Person aus der angetippten Benachrichtigung, mit der die App gestartet wurde. Einmal lesbar. */
    Function("launchPerson") {
      val activity = appContext.currentActivity ?: return@Function null
      val id = activity.intent?.getStringExtra(Notifier.EXTRA_PERSON)
      activity.intent?.removeExtra(Notifier.EXTRA_PERSON)
      id
    }

    OnNewIntent { intent ->
      val id = intent.getStringExtra(Notifier.EXTRA_PERSON) ?: return@OnNewIntent
      intent.removeExtra(Notifier.EXTRA_PERSON)
      sendEvent("onOpenPerson", mapOf("id" to id))
    }
  }
}
