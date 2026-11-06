package de.aaron.birthdays.alarms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import java.io.File
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/** Baut und zeigt die Benachrichtigungen. */
object Notifier {
  const val CHANNEL = "birthdays"
  const val CHANNEL_ALARM = "birthdays_alarm"
  private const val GROUP = "de.aaron.birthdays.TODAY"
  private const val SUMMARY_ID = 1
  const val EXTRA_PERSON = "birthdayPerson"

  /** Eine fällige Erinnerung. n = 0 heißt "am Tag". */
  data class Due(val person: Person, val n: Int, val unit: Char, val fullscreen: Boolean, val hint: String, val day: LocalDate, val snoozed: Boolean)

  fun idFor(personId: String) = (personId.hashCode() and 0x7ffffff) + 100

  fun ensureChannels(context: Context, texts: Texts) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = context.getSystemService(NotificationManager::class.java) ?: return
    nm.createNotificationChannel(NotificationChannel(CHANNEL, texts.channelName, NotificationManager.IMPORTANCE_HIGH).apply {
      enableVibration(true)
    })
    nm.createNotificationChannel(NotificationChannel(CHANNEL_ALARM, texts.channelAlarmName, NotificationManager.IMPORTANCE_HIGH).apply {
      enableVibration(true)
      setSound(
        RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION),
        AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(),
      )
    })
  }

  fun post(context: Context, payload: Payload, dues: List<Due>) {
    if (dues.isEmpty()) return
    val texts = Texts(payload.lang, payload.dayFirst)
    ensureChannels(context, texts)
    val nm = NotificationManagerCompat.from(context)
    if (!nm.areNotificationsEnabled()) return
    for (due in dues) {
      try {
        nm.notify(idFor(due.person.id), build(context, payload, texts, due))
      } catch (_: SecurityException) {
        // Erlaubnis fehlt: nichts zu tun, die App zeigt beim Öffnen Screen 9
      }
    }
    val today = activeToday(context)
    if (today >= 2) {
      try {
        nm.notify(
          SUMMARY_ID,
          NotificationCompat.Builder(context, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_birthday)
            .setColor(ACCENT)
            .setContentTitle(texts.todayCount(today))
            .setSubText(texts.countShort(today))
            .setGroup(GROUP)
            .setGroupSummary(true)
            .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
            .setAutoCancel(true)
            .build(),
        )
      } catch (_: SecurityException) {
      }
    }
  }

  private fun activeToday(context: Context): Int {
    val nm = context.getSystemService(NotificationManager::class.java) ?: return 0
    return nm.activeNotifications.count { it.notification.group == GROUP && it.id != SUMMARY_ID }
  }

  fun cancel(context: Context, personId: String) {
    val nm = NotificationManagerCompat.from(context)
    nm.cancel(idFor(personId))
    if (activeToday(context) < 2) nm.cancel(SUMMARY_ID)
  }

  private fun build(context: Context, payload: Payload, texts: Texts, due: Due): android.app.Notification {
    val p = due.person
    val age = p.year?.let { due.day.year - it }
    val isDay = due.n == 0
    val title: String
    val body: String
    if (isDay) {
      title = texts.dayTitle(p, age)
      body = listOf(p.sign, due.hint, p.note).filter { it.isNotBlank() }.joinToString(" · ")
    } else {
      val days = ChronoUnit.DAYS.between(LocalDate.now(ZoneId.systemDefault()), due.day)
      val lead = if (due.snoozed) texts.leadDays(days) else texts.lead(due.n, due.unit)
      title = texts.preTitle(p, age, lead)
      body = listOf(texts.longDate(due.day), due.hint, p.note).filter { it.isNotBlank() }.joinToString(" · ")
    }
    val channel = if (due.fullscreen) CHANNEL_ALARM else CHANNEL
    val b = NotificationCompat.Builder(context, channel)
      .setSmallIcon(R.drawable.ic_stat_birthday)
      .setColor(ACCENT)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(if (due.fullscreen) NotificationCompat.CATEGORY_ALARM else NotificationCompat.CATEGORY_REMINDER)
      .setAutoCancel(true)
      .setContentIntent(openApp(context, p.id))
    photo(p.photo)?.let { b.setLargeIcon(it) }
    if (isDay) b.setGroup(GROUP)

    val dateKey = due.day.toString()
    if (isDay) {
      b.addAction(0, texts.end, action(context, ActionReceiver.DONE, p.id, dateKey, due))
      b.addAction(0, texts.inOneHour, action(context, ActionReceiver.SNOOZE_HOUR, p.id, dateKey, due))
    } else {
      b.addAction(0, texts.end, action(context, ActionReceiver.DISMISS, p.id, dateKey, due))
      b.addAction(0, texts.tomorrow, action(context, ActionReceiver.SNOOZE_DAY, p.id, dateKey, due))
    }
    b.addAction(0, texts.open, openApp(context, p.id))

    if (due.fullscreen) {
      val full = Intent(context, AlarmActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION
        putExtra(AlarmActivity.EXTRA_PERSON, p.id)
        putExtra(AlarmActivity.EXTRA_DATE, dateKey)
        putExtra(AlarmActivity.EXTRA_N, due.n)
        putExtra(AlarmActivity.EXTRA_HINT, due.hint)
      }
      val pi = PendingIntent.getActivity(context, idFor(p.id), full, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
      b.setFullScreenIntent(pi, true)
      b.setOngoing(true)
      b.setAutoCancel(false)
    }

    when (payload.lockScreen) {
      "all" -> b.setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      "name" -> {
        b.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        b.setPublicVersion(
          NotificationCompat.Builder(context, channel).setSmallIcon(R.drawable.ic_stat_birthday).setColor(ACCENT).setContentTitle(title).build(),
        )
      }
      else -> {
        b.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        b.setPublicVersion(
          NotificationCompat.Builder(context, channel)
            .setSmallIcon(R.drawable.ic_stat_birthday)
            .setColor(ACCENT)
            .setContentTitle(if (isDay) texts.genericToday else texts.genericSoon)
            .build(),
        )
      }
    }
    return b.build()
  }

  fun openApp(context: Context, personId: String?): PendingIntent {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      if (personId != null) putExtra(EXTRA_PERSON, personId)
    } ?: Intent()
    return PendingIntent.getActivity(context, (personId?.hashCode() ?: 0) and 0xffff, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  private fun action(context: Context, what: String, personId: String, date: String, due: Due): PendingIntent {
    val intent = Intent(context, ActionReceiver::class.java).apply {
      action = what
      putExtra(ActionReceiver.EXTRA_PERSON, personId)
      putExtra(ActionReceiver.EXTRA_DATE, date)
      putExtra(ActionReceiver.EXTRA_N, due.n)
      putExtra(ActionReceiver.EXTRA_FULLSCREEN, due.fullscreen)
      putExtra(ActionReceiver.EXTRA_HINT, due.hint)
    }
    val code = (personId + what).hashCode()
    return PendingIntent.getBroadcast(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Rundes Bild für die Benachrichtigung, oder null. */
  fun photo(path: String): Bitmap? {
    if (path.isBlank()) return null
    return try {
      val file = File(path.removePrefix("file://"))
      if (!file.exists()) return null
      val src = BitmapFactory.decodeFile(file.absolutePath) ?: return null
      val size = minOf(src.width, src.height)
      val out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(out)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG)
      canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
      paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
      val left = (src.width - size) / 2
      val top = (src.height - size) / 2
      canvas.drawBitmap(src, Rect(left, top, left + size, top + size), Rect(0, 0, size, size), paint)
      out
    } catch (_: Exception) {
      null
    }
  }

  /** Rosa des Icons, für die Farbe der Benachrichtigung. */
  const val ACCENT = 0xFFD2356F.toInt()
}
