package de.aaron.birthdays.alarms

import android.app.Activity
import android.app.KeyguardManager
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import java.lang.ref.WeakReference
import java.time.LocalDate

/**
 * Vollbild am Geburtstag (Screen 11): erscheint wie ein Wecker über dem Sperrbildschirm,
 * klingelt und vibriert, bis man "Beenden" oder "In 1 Stunde erinnern" tippt.
 * Läuft ohne die React-Oberfläche, damit es auch bei geschlossener App sofort da ist.
 */
class AlarmActivity : Activity() {
  private var personId: String = ""
  private var date: String = ""
  private var n: Int = 0
  private var hint: String = ""
  private var ringtone: Ringtone? = null
  private var vibrator: Vibrator? = null
  private val handler = Handler(Looper.getMainLooper())

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    personId = intent.getStringExtra(EXTRA_PERSON) ?: ""
    date = intent.getStringExtra(EXTRA_DATE) ?: ""
    n = intent.getIntExtra(EXTRA_N, 0)
    hint = intent.getStringExtra(EXTRA_HINT) ?: ""
    val payload = Store(this).payload()
    val person = payload?.person(personId)
    if (payload == null || person == null) {
      finish()
      return
    }
    current = WeakReference(this)
    setContentView(layout(payload, person))
    startAlarm()
    // Nach drei Minuten still werden, die Benachrichtigung bleibt.
    handler.postDelayed({ stopAlarm() }, 3 * 60 * 1000L)
  }

  override fun onDestroy() {
    stopAlarm()
    handler.removeCallbacksAndMessages(null)
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  @Deprecated("Zurück schaltet nur den Ton ab, die Benachrichtigung bleibt")
  override fun onBackPressed() {
    stopAlarm()
    finish()
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    getSystemService(KeyguardManager::class.java)
  }

  private fun dp(v: Float) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, resources.displayMetrics).toInt()

  private fun layout(payload: Payload, p: Person): View {
    val texts = Texts(payload.lang, payload.dayFirst)
    val day = runCatching { LocalDate.parse(date) }.getOrNull() ?: LocalDate.now()
    val age = p.year?.let { day.year - it }
    val ink = Color.parseColor("#4A1229")
    val deep = Color.parseColor("#8F2F5B")

    val root = FrameLayout(this).apply {
      background = GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM, intArrayOf(Color.parseColor("#FFF0F5"), Color.parseColor("#FBD3E1"), Color.parseColor("#F4B4CB")))
    }
    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(28f), dp(72f), dp(28f), dp(28f))
    }
    fun text(value: String, size: Float, bold: Boolean = false, color: Int = ink, top: Int = 0) = TextView(this).apply {
      text = value
      setTextColor(color)
      setTextSize(TypedValue.COMPLEX_UNIT_SP, size)
      gravity = Gravity.CENTER
      if (bold) typeface = Typeface.DEFAULT_BOLD
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(top.toFloat()) }
    }

    column.addView(text((if (n == 0) texts.todayHas else texts.preTitle(p, age, texts.lead(n, 'd'))).uppercase(), 13f, true, deep).apply { letterSpacing = 0.08f })

    val size = dp(104f)
    val avatar = FrameLayout(this).apply {
      layoutParams = LinearLayout.LayoutParams(size, size).apply { topMargin = dp(28f); gravity = Gravity.CENTER_HORIZONTAL }
      background = GradientDrawable().apply { shape = GradientDrawable.OVAL; setColor(Color.parseColor("#D6409F")); setStroke(dp(3f), Color.WHITE) }
    }
    val photo = Notifier.photo(p.photo)
    if (photo != null) {
      avatar.addView(ImageView(this).apply { setImageBitmap(photo); layoutParams = FrameLayout.LayoutParams(size, size) })
    } else {
      avatar.addView(TextView(this).apply {
        text = initials(p.name)
        setTextColor(Color.WHITE)
        setTextSize(TypedValue.COMPLEX_UNIT_SP, 34f)
        typeface = Typeface.DEFAULT_BOLD
        gravity = Gravity.CENTER
        layoutParams = FrameLayout.LayoutParams(size, size)
      })
    }
    column.addView(avatar)
    column.addView(text(p.name, 30f, true, ink, 18))
    val sub = listOf(texts.turns(age, n == 0), p.sign).filter { it.isNotBlank() }.joinToString(" · ")
    if (sub.isNotBlank()) column.addView(text(sub, 17f, false, ink, 4))
    val note = listOf(hint, p.note).filter { it.isNotBlank() }.joinToString("\n")
    if (note.isNotBlank()) {
      column.addView(text(note, 15f, false, ink, 24).apply {
        gravity = Gravity.START
        setPadding(dp(16f), dp(12f), dp(16f), dp(12f))
        background = GradientDrawable().apply { cornerRadius = dp(16f).toFloat(); setColor(Color.argb(150, 255, 255, 255)) }
        maxLines = 6
      })
    }
    root.addView(column, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT))

    val buttons = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(dp(24f), 0, dp(24f), dp(40f))
    }
    fun button(label: String, filled: Boolean, onTap: () -> Unit) = TextView(this).apply {
      text = label
      setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
      typeface = Typeface.DEFAULT_BOLD
      gravity = Gravity.CENTER
      setTextColor(deep)
      setPadding(0, dp(17f), 0, dp(17f))
      background = GradientDrawable().apply {
        cornerRadius = dp(18f).toFloat()
        if (filled) setColor(Color.WHITE) else setStroke(dp(2f), Color.argb(115, 143, 47, 91))
      }
      isClickable = true
      isFocusable = true
      setOnClickListener { onTap() }
      layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(10f) }
    }
    buttons.addView(button(texts.end, true) {
      stopAlarm()
      if (n == 0) Actions.done(this, personId, date) else Actions.dismiss(this, personId)
      finish()
    })
    buttons.addView(button(texts.inOneHourLong, false) {
      stopAlarm()
      Actions.snooze(this, personId, date, n, true, hint, 60 * 60 * 1000L)
      finish()
    })
    root.addView(buttons, FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
    return root
  }

  private fun startAlarm() {
    try {
      val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
      ringtone = RingtoneManager.getRingtone(this, uri)?.apply {
        audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) isLooping = true
        play()
      }
    } catch (_: Exception) {
    }
    try {
      vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        getSystemService(VibratorManager::class.java)?.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Vibrator::class.java)
      }
      vibrator?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 600), 0))
    } catch (_: Exception) {
    }
  }

  private fun stopAlarm() {
    try {
      ringtone?.stop()
    } catch (_: Exception) {
    }
    ringtone = null
    try {
      vibrator?.cancel()
    } catch (_: Exception) {
    }
    vibrator = null
  }

  companion object {
    const val EXTRA_PERSON = "person"
    const val EXTRA_DATE = "date"
    const val EXTRA_N = "n"
    const val EXTRA_HINT = "hint"
    private var current: WeakReference<AlarmActivity>? = null

    /** Schließt das Vollbild, wenn es für diese Person offen ist (z. B. "Beenden" in der Benachrichtigung). */
    fun closeFor(personId: String) {
      val a = current?.get() ?: return
      if (a.personId == personId) a.runOnUiThread {
        a.stopAlarm()
        a.finish()
      }
    }

    fun initials(name: String): String =
      name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }.take(2).joinToString("") { it.substring(0, 1).uppercase() }
  }
}
